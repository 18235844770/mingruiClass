import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListConsumptionsQueryDto } from './dto/list-consumptions-query.dto';
import { CreateConsumptionDto } from './dto/create-consumption.dto';
import { mapConsumptionIdToRemainingAfter } from './consumption-remaining-after.util';
import { PrismaService } from '../prisma/prisma.service';

type RequestUser = {
  userId: string;
  roleCode: string;
  campusId?: string;
};

const DUPLICATE_WARNING_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class ConsumptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createByScope(user: RequestUser, dto: CreateConsumptionDto) {
    const consumedHours = this.parsePositiveDecimal(dto.consumedHours);
    const consumptionTime = this.parseDate(dto.consumptionTime);
    const scope = this.buildStudentScope(user);

    const course = await this.prisma.studentCourse.findFirst({
      where: {
        id: dto.studentCourseId,
        deletedAt: null,
        student: scope,
      },
      select: {
        id: true,
        courseName: true,
        student: {
          select: {
            id: true,
            name: true,
            campusId: true,
          },
        },
      },
    });
    if (!course) {
      throw new NotFoundException('课程不存在或无权限操作');
    }

    const duplicateHit = await this.findDuplicateConsumption(
      dto.studentCourseId,
      consumedHours,
      consumptionTime,
    );
    if (duplicateHit && !dto.duplicateWarningAcknowledged) {
      throw new ConflictException({
        message: '检测到疑似重复消课，请确认后重试',
        duplicateWarning: true,
        duplicateCandidate: {
          id: duplicateHit.id,
          consumptionTime: duplicateHit.consumptionTime,
          consumedHours: duplicateHit.consumedHours.toString(),
        },
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedCourse = await tx.studentCourse.update({
        where: { id: dto.studentCourseId },
        data: {
          remainingHours: {
            decrement: consumedHours,
          },
        },
        select: {
          id: true,
          remainingHours: true,
          courseName: true,
          student: {
            select: {
              id: true,
              name: true,
              campusId: true,
            },
          },
        },
      });

      const createdConsumption = await tx.courseConsumption.create({
        data: {
          studentCourseId: dto.studentCourseId,
          consumedHours,
          consumptionTime,
          operatorId: user.userId,
          remark: dto.remark?.trim() || undefined,
        },
        select: {
          id: true,
          studentCourseId: true,
          consumedHours: true,
          consumptionTime: true,
          operatorId: true,
          remark: true,
          createdAt: true,
        },
      });

      const beforeRemainingHours =
        updatedCourse.remainingHours.add(consumedHours);
      await tx.operationLog.create({
        data: {
          operatorId: user.userId,
          module: 'consumptions',
          action: 'create',
          targetId: createdConsumption.id,
          campusId: updatedCourse.student.campusId,
          detail: {
            consumptionId: createdConsumption.id,
            studentId: updatedCourse.student.id,
            studentName: updatedCourse.student.name,
            studentCourseId: updatedCourse.id,
            courseName: updatedCourse.courseName,
            consumedHours: createdConsumption.consumedHours.toString(),
            consumptionTime: createdConsumption.consumptionTime.toISOString(),
            remainingHoursBefore: beforeRemainingHours.toString(),
            remainingHoursAfter: updatedCourse.remainingHours.toString(),
            duplicateWarningAcknowledged: Boolean(
              dto.duplicateWarningAcknowledged,
            ),
          },
        },
      });

      return {
        createdConsumption,
        remainingHours: updatedCourse.remainingHours,
      };
    });

    return {
      data: {
        ...result.createdConsumption,
        consumedHours: result.createdConsumption.consumedHours.toString(),
        isLowHours: result.remainingHours.lessThan(3),
        isNegativeHours: result.remainingHours.lessThan(0),
        remainingHoursAfter: result.remainingHours.toString(),
      },
      duplicateWarning: Boolean(duplicateHit),
    };
  }

  async listByScope(user: RequestUser, query: ListConsumptionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const where = this.buildListWhere(user, query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.courseConsumption.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ consumptionTime: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          studentCourseId: true,
          consumedHours: true,
          consumptionTime: true,
          operatorId: true,
          remark: true,
          createdAt: true,
          studentCourse: {
            select: {
              id: true,
              courseName: true,
              remainingHours: true,
              student: {
                select: {
                  id: true,
                  name: true,
                  grade: true,
                },
              },
            },
          },
          operator: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
      this.prisma.courseConsumption.count({ where }),
    ]);

    const courseIds = [...new Set(rows.map((r) => r.studentCourseId))];
    const timelineRows =
      courseIds.length === 0
        ? []
        : await this.prisma.courseConsumption.findMany({
            where: { studentCourseId: { in: courseIds } },
            select: {
              id: true,
              studentCourseId: true,
              consumedHours: true,
              consumptionTime: true,
              createdAt: true,
            },
          });
    const remainingByConsumptionId = mapConsumptionIdToRemainingAfter(
      rows,
      timelineRows,
    );

    return {
      data: rows.map((row) => {
        const remainingAfter = remainingByConsumptionId.get(row.id)!;
        return {
          id: row.id,
          studentId: row.studentCourse.student.id,
          studentName: row.studentCourse.student.name,
          studentGrade: row.studentCourse.student.grade,
          studentCourseId: row.studentCourseId,
          courseName: row.studentCourse.courseName,
          consumedHours: row.consumedHours.toString(),
          consumptionTime: row.consumptionTime,
          operatorId: row.operatorId,
          operatorName: row.operator?.username ?? '-',
          remark: row.remark,
          createdAt: row.createdAt,
          remainingHoursAfter: remainingAfter.toString(),
          isLowHours: remainingAfter.lessThan(3),
          isNegativeHours: remainingAfter.lessThan(0),
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  private buildListWhere(
    user: RequestUser,
    query: ListConsumptionsQueryDto,
  ): Prisma.CourseConsumptionWhereInput {
    const scope = this.buildStudentScope(user);
    const consumptionTime =
      query.startTime || query.endTime
        ? {
            ...(query.startTime
              ? { gte: this.parseDate(query.startTime) }
              : {}),
            ...(query.endTime ? { lte: this.parseDate(query.endTime) } : {}),
          }
        : undefined;

    return {
      ...(query.operatorId ? { operatorId: query.operatorId } : {}),
      ...(consumptionTime ? { consumptionTime } : {}),
      studentCourse: {
        deletedAt: null,
        ...(query.studentCourseId ? { id: query.studentCourseId } : {}),
        student: {
          ...scope,
          ...(query.studentId ? { id: query.studentId } : {}),
          ...(typeof query.grade === 'string' && query.grade.trim().length > 0
            ? { grade: query.grade.trim() }
            : {}),
        },
      },
    };
  }

  private buildStudentScope(user: RequestUser): Prisma.StudentWhereInput {
    if (user.roleCode === 'sales') {
      if (!user.campusId) {
        throw new BadRequestException('销售账号缺少校区上下文');
      }
      return {
        deletedAt: null,
        campusId: user.campusId,
        createdBy: user.userId,
      };
    }

    if (user.campusId) {
      return {
        deletedAt: null,
        campusId: user.campusId,
      };
    }

    return { deletedAt: null };
  }

  private parsePositiveDecimal(value: string) {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException('consumedHours 不能为空');
    }
    let decimalValue: Prisma.Decimal;
    try {
      decimalValue = new Prisma.Decimal(normalized);
    } catch {
      throw new BadRequestException('consumedHours 格式不合法');
    }
    if (decimalValue.lessThanOrEqualTo(0)) {
      throw new BadRequestException('consumedHours 必须大于 0');
    }
    return decimalValue;
  }

  private parseDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('时间格式不合法');
    }
    return date;
  }

  private findDuplicateConsumption(
    studentCourseId: string,
    consumedHours: Prisma.Decimal,
    consumptionTime: Date,
  ) {
    return this.prisma.courseConsumption.findFirst({
      where: {
        studentCourseId,
        consumedHours,
        consumptionTime: {
          gte: new Date(
            consumptionTime.getTime() - DUPLICATE_WARNING_WINDOW_MS,
          ),
          lte: new Date(
            consumptionTime.getTime() + DUPLICATE_WARNING_WINDOW_MS,
          ),
        },
      },
      orderBy: {
        consumptionTime: 'desc',
      },
      select: {
        id: true,
        consumedHours: true,
        consumptionTime: true,
      },
    });
  }
}
