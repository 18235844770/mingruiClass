import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OperationLogsService } from '../logs/operation-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { ListStudentsQueryDto } from './dto/list-students-query.dto';
import type { UpdateStudentDto } from './dto/update-student.dto';
import {
  STUDENT_GENDER_LIST,
  STUDENT_GRADE_LIST,
} from './student-profile.constants';
import { buildSalesStudentScope } from './students.scope';

type RequestUser = {
  userId: string;
  roleCode: string;
  campusId?: string;
};

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogs: OperationLogsService,
  ) {}

  async listByScope(input: { user: RequestUser; query: ListStudentsQueryDto }) {
    const user = input.user;
    const query = input.query;
    const page = this.sanitizePositiveInt(query.page, 1);
    const pageSize = this.sanitizePositiveInt(query.pageSize, 10, 100);
    const offset = (page - 1) * pageSize;
    const hoursMode = this.hoursFilterMode(query);

    if (hoursMode !== 'none') {
      return this.listByScopeWithHoursAggregation(
        user,
        query,
        page,
        pageSize,
        offset,
        hoursMode,
      );
    }

    const where = this.buildWhere(user, query);
    const [total, rows] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        skip: offset,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: this.listSelectShape(),
      }),
    ]);

    return {
      data: rows.map((r) => this.toListRow(r)),
      total,
      page,
      pageSize,
    };
  }

  private hoursFilterMode(
    query: ListStudentsQueryDto,
  ): 'none' | 'low' | 'negative' {
    if (query.negativeHours) {
      return 'negative';
    }
    if (query.lowHours) {
      return 'low';
    }
    return 'none';
  }

  private listSelectShape(): Prisma.StudentSelect {
    return {
      id: true,
      name: true,
      phone: true,
      grade: true,
      gender: true,
      totalAmount: true,
      paidStatus: true,
      remark: true,
      campusId: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
      courses: {
        where: { deletedAt: null },
        select: { remainingHours: true },
      },
    };
  }

  private toListRow(
    r: Prisma.StudentGetPayload<{ select: Prisma.StudentSelect }>,
  ) {
    const courses = r.courses ?? [];
    const totalRemainingHours = courses.reduce(
      (sum, course) => sum + Number(course.remainingHours),
      0,
    );
    const isNegativeHours = totalRemainingHours < 0;
    const isLowHours = totalRemainingHours < 3;
    const hasCourses = courses.length > 0;
    const isArrears = hasCourses && !r.paidStatus;
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      grade: r.grade,
      gender: r.gender,
      totalAmount: r.totalAmount.toString(),
      paidStatus: r.paidStatus,
      remark: r.remark,
      campusId: r.campusId,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      remainingHours: totalRemainingHours.toFixed(2),
      isLowHours,
      isNegativeHours,
      isArrears,
    };
  }

  private async listByScopeWithHoursAggregation(
    user: RequestUser,
    query: ListStudentsQueryDto,
    page: number,
    pageSize: number,
    offset: number,
    mode: 'low' | 'negative',
  ) {
    const whereSql = this.buildStudentListRawWhere(user, query);
    const havingSql =
      mode === 'negative'
        ? Prisma.sql`COALESCE(SUM(sc.remaining_hours), 0) < 0`
        : Prisma.sql`COALESCE(SUM(sc.remaining_hours), 0) < 3`;

    const countRows = await this.prisma.$queryRaw<{ c: number }[]>`
      SELECT COUNT(*)::int AS c
      FROM (
        SELECT s.id
        FROM students s
        LEFT JOIN student_courses sc
          ON sc.student_id = s.id AND sc.deleted_at IS NULL
        WHERE ${whereSql}
        GROUP BY s.id
        HAVING ${havingSql}
      ) sub
    `;
    const total = Number(countRows[0]?.c ?? 0);

    if (total === 0) {
      return { data: [], total: 0, page, pageSize };
    }

    const idRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT s.id
      FROM students s
      LEFT JOIN student_courses sc
        ON sc.student_id = s.id AND sc.deleted_at IS NULL
      WHERE ${whereSql}
      GROUP BY s.id
      HAVING ${havingSql}
      ORDER BY COALESCE(SUM(sc.remaining_hours), 0) ASC,
        MAX(s.updated_at) DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const ids = idRows.map((row) => row.id);
    if (ids.length === 0) {
      return { data: [], total, page, pageSize };
    }

    const rows = await this.prisma.student.findMany({
      where: { id: { in: ids } },
      select: this.listSelectShape(),
    });
    const order = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    return {
      data: rows.map((r) => this.toListRow(r)),
      total,
      page,
      pageSize,
    };
  }

  private buildStudentListRawWhere(
    user: RequestUser,
    query: ListStudentsQueryDto,
  ): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`s.deleted_at IS NULL`];

    if (user.roleCode === 'sales') {
      if (!user.campusId) {
        throw new BadRequestException('销售账号缺少校区上下文');
      }
      // 不使用 ::uuid：Prisma 绑定为 text 时与列类型比较会触发 PG「text = uuid」错误（42883）
      parts.push(Prisma.sql`s.campus_id = ${user.campusId}`);
      parts.push(Prisma.sql`s.created_by = ${user.userId}`);
    } else if (user.campusId) {
      parts.push(Prisma.sql`s.campus_id = ${user.campusId}`);
    }

    if (typeof query.name === 'string' && query.name.trim().length > 0) {
      const pattern = `%${query.name.trim()}%`;
      parts.push(Prisma.sql`s.name ILIKE ${pattern}`);
    }
    if (typeof query.phone === 'string' && query.phone.trim().length > 0) {
      const pattern = `%${query.phone.trim()}%`;
      parts.push(Prisma.sql`s.phone ILIKE ${pattern}`);
    }
    if (query.paidStatus !== undefined) {
      parts.push(Prisma.sql`s.paid_status = ${query.paidStatus}`);
    }
    if (typeof query.grade === 'string' && query.grade.trim().length > 0) {
      parts.push(Prisma.sql`s.grade = ${query.grade.trim()}`);
    }

    return Prisma.join(parts, ' AND ');
  }

  async createByScope(user: RequestUser, dto: CreateStudentDto) {
    const normalizedName = dto.name.trim();
    const campusId = this.resolveCampusIdForCreate(user, dto.campusId);
    const createdBy = user.userId;
    await this.assertUniqueNameInCampus(campusId, normalizedName);

    const row = await this.prisma.student.create({
      data: {
        name: normalizedName,
        phone: dto.phone,
        grade: this.parseOptionalGrade(dto.grade),
        gender: this.parseOptionalGender(dto.gender),
        totalAmount: '0',
        paidStatus: false,
        remark: dto.remark,
        campusId,
        createdBy,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        grade: true,
        gender: true,
        totalAmount: true,
        paidStatus: true,
        remark: true,
        campusId: true,
        createdBy: true,
      },
    });

    await this.operationLogs.create({
      operatorId: user.userId,
      module: 'students',
      action: 'create',
      targetId: row.id,
      campusId: row.campusId,
      detail: {
        name: row.name,
        phone: row.phone,
        grade: row.grade,
        gender: row.gender,
        totalAmount: row.totalAmount.toString(),
        paidStatus: row.paidStatus,
      },
    });

    return {
      ...row,
      totalAmount: row.totalAmount.toString(),
    };
  }

  async detailByScope(user: RequestUser, id: string) {
    const row = await this.prisma.student.findFirst({
      where: {
        id,
        ...this.buildScopeWhere(user),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        grade: true,
        gender: true,
        totalAmount: true,
        paidStatus: true,
        remark: true,
        campusId: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        courses: {
          where: { deletedAt: null },
          select: {
            id: true,
            courseName: true,
            coursePrice: true,
            paidStatus: true,
            totalHours: true,
            remainingHours: true,
            courseType: true,
            remark: true,
            createdAt: true,
            consumptions: {
              select: {
                id: true,
                consumedHours: true,
                consumptionTime: true,
                operatorId: true,
                remark: true,
                createdAt: true,
              },
              orderBy: { consumptionTime: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('学生不存在或无权限操作');
    }

    const courses = row.courses.map((course) => ({
      id: course.id,
      courseName: course.courseName,
      coursePrice: course.coursePrice.toString(),
      paidStatus: course.paidStatus,
      totalHours: course.totalHours.toString(),
      remainingHours: course.remainingHours.toString(),
      courseType: course.courseType,
      remark: course.remark,
      createdAt: course.createdAt,
    }));

    const consumptionHistory = row.courses.flatMap((course) =>
      course.consumptions.map((consumption) => ({
        id: consumption.id,
        courseId: course.id,
        courseName: course.courseName,
        consumedHours: consumption.consumedHours.toString(),
        consumptionTime: consumption.consumptionTime,
        operatorId: consumption.operatorId,
        remark: consumption.remark,
        createdAt: consumption.createdAt,
      })),
    );

    const consumedHoursTotal = consumptionHistory.reduce(
      (sum, item) => sum + Number(item.consumedHours),
      0,
    );

    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      grade: row.grade,
      gender: row.gender,
      totalAmount: row.totalAmount.toString(),
      paidStatus: row.paidStatus,
      remark: row.remark,
      campusId: row.campusId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      courses,
      consumptionSummary: {
        count: consumptionHistory.length,
        totalConsumedHours: consumedHoursTotal.toFixed(2),
      },
      consumptionHistory,
    };
  }

  async updateByScope(user: RequestUser, id: string, dto: UpdateStudentDto) {
    const existing = await this.findAccessibleStudent(user, id);
    if (!existing) {
      throw new NotFoundException('学生不存在或无权限操作');
    }

    const nextName = dto.name?.trim();
    if (nextName && nextName.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertUniqueNameInCampus(existing.campusId, nextName, id);
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
        ...(dto.grade !== undefined
          ? { grade: this.parseOptionalGradeForUpdate(dto.grade) }
          : {}),
        ...(dto.gender !== undefined
          ? { gender: this.parseOptionalGenderForUpdate(dto.gender) }
          : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        grade: true,
        gender: true,
        totalAmount: true,
        paidStatus: true,
        remark: true,
        campusId: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.operationLogs.create({
      operatorId: user.userId,
      module: 'students',
      action: 'update',
      targetId: updated.id,
      campusId: updated.campusId,
      detail: {
        before: {
          name: existing.name,
          phone: existing.phone,
          grade: existing.grade,
          gender: existing.gender,
          totalAmount: existing.totalAmount.toString(),
          paidStatus: existing.paidStatus,
          remark: existing.remark,
        },
        after: {
          name: updated.name,
          phone: updated.phone,
          grade: updated.grade,
          gender: updated.gender,
          totalAmount: updated.totalAmount.toString(),
          paidStatus: updated.paidStatus,
          remark: updated.remark,
        },
      },
    });

    return {
      ...updated,
      totalAmount: updated.totalAmount.toString(),
    };
  }

  async removeByScope(user: RequestUser, id: string) {
    const existing = await this.findAccessibleStudent(user, id);
    if (!existing) {
      throw new NotFoundException('学生不存在或无权限操作');
    }

    const deletedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.student.update({
        where: { id },
        data: { deletedAt },
      }),
      this.prisma.studentCourse.updateMany({
        where: { studentId: id, deletedAt: null },
        data: { deletedAt },
      }),
    ]);

    await this.operationLogs.create({
      operatorId: user.userId,
      module: 'students',
      action: 'delete',
      targetId: existing.id,
      campusId: existing.campusId,
      detail: {
        name: existing.name,
        phone: existing.phone,
        totalAmount: existing.totalAmount.toString(),
        paidStatus: existing.paidStatus,
      },
    });

    return { success: true };
  }

  private buildWhere(
    user: RequestUser,
    query: ListStudentsQueryDto,
  ): Prisma.StudentWhereInput {
    const scopeWhere = this.buildScopeWhere(user);
    const name =
      typeof query.name === 'string' && query.name.trim().length > 0
        ? query.name.trim()
        : undefined;
    const phone =
      typeof query.phone === 'string' && query.phone.trim().length > 0
        ? query.phone.trim()
        : undefined;
    return {
      ...scopeWhere,
      ...(name
        ? {
            name: {
              contains: name,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(phone
        ? {
            phone: {
              contains: phone,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.paidStatus !== undefined
        ? { paidStatus: query.paidStatus }
        : {}),
      ...(typeof query.grade === 'string' && query.grade.trim().length > 0
        ? { grade: query.grade.trim() }
        : {}),
    };
  }

  private buildScopeWhere(user: RequestUser): Prisma.StudentWhereInput {
    if (user.roleCode === 'sales') {
      if (!user.campusId) {
        throw new BadRequestException('销售账号缺少校区上下文');
      }
      return buildSalesStudentScope(user.userId, user.campusId);
    }

    if (user.campusId) {
      return {
        deletedAt: null,
        campusId: user.campusId,
      };
    }

    return { deletedAt: null };
  }

  private async assertUniqueNameInCampus(
    campusId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.student.findFirst({
      where: {
        deletedAt: null,
        campusId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('同一校区下学生姓名不能重复');
    }
  }

  private findAccessibleStudent(user: RequestUser, id: string) {
    return this.prisma.student.findFirst({
      where: {
        id,
        ...this.buildScopeWhere(user),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        grade: true,
        gender: true,
        totalAmount: true,
        paidStatus: true,
        remark: true,
        campusId: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private parseOptionalGrade(raw?: string | null): string | null {
    if (raw === undefined || raw === null) {
      return null;
    }
    const t = raw.trim();
    if (!t) {
      return null;
    }
    if (!STUDENT_GRADE_LIST.includes(t)) {
      throw new BadRequestException('年级不在允许的范围内');
    }
    return t;
  }

  private parseOptionalGender(raw?: string | null): string | null {
    if (raw === undefined || raw === null) {
      return null;
    }
    const t = raw.trim();
    if (!t) {
      return null;
    }
    if (!STUDENT_GENDER_LIST.includes(t)) {
      throw new BadRequestException('性别不在允许的范围内');
    }
    return t;
  }

  private parseOptionalGradeForUpdate(raw: string): string | null {
    const t = raw.trim();
    if (!t) {
      return null;
    }
    if (!STUDENT_GRADE_LIST.includes(t)) {
      throw new BadRequestException('年级不在允许的范围内');
    }
    return t;
  }

  private parseOptionalGenderForUpdate(raw: string): string | null {
    const t = raw.trim();
    if (!t) {
      return null;
    }
    if (!STUDENT_GENDER_LIST.includes(t)) {
      throw new BadRequestException('性别不在允许的范围内');
    }
    return t;
  }

  private sanitizePositiveInt(
    raw: number | undefined,
    fallback: number,
    max?: number,
  ): number {
    const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : fallback;
    if (n < 1) {
      return fallback;
    }
    if (max !== undefined && n > max) {
      return max;
    }
    return n;
  }

  private resolveCampusIdForCreate(user: RequestUser, campusIdInBody?: string) {
    if (user.roleCode === 'sales') {
      if (!user.campusId) {
        throw new BadRequestException('销售账号缺少校区上下文');
      }
      return user.campusId;
    }
    if (!campusIdInBody) {
      throw new BadRequestException('非销售账号创建学生时必须指定 campusId');
    }
    return campusIdInBody;
  }
}
