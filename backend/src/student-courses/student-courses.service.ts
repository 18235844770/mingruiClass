import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OperationLogsService } from '../logs/operation-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateStudentCoursesDto } from './dto/create-student-courses.dto';

type RequestUser = {
  userId: string;
  roleCode: string;
  campusId?: string;
};

type TxClient = Prisma.TransactionClient;

@Injectable()
export class StudentCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogs: OperationLogsService,
  ) {}

  /**
   * 全量同步课程：更新（带 id）、新增（不带 id）、删除（库里有但未出现在 payload 中且无消课记录）。
   * 同步后重算学生 total_amount（课程价之和）与 paid_status（存在课程且全部已交费）。
   */
  async createBatchByScope(
    user: RequestUser,
    studentId: string,
    dto: CreateStudentCoursesDto,
  ) {
    const student = await this.findAccessibleStudent(user, studentId);
    if (!student) {
      throw new NotFoundException('学生不存在或无权限操作');
    }

    const normalizedCourses = dto.courses.map((course) => ({
      id: course.id?.trim() || undefined,
      courseName: course.courseName.trim(),
      coursePrice: course.coursePrice.trim(),
      totalHours: course.totalHours.trim(),
      remainingHours: course.remainingHours.trim(),
      courseType: course.courseType.trim(),
      remark: course.remark?.trim() || undefined,
      paidStatus: course.paidStatus,
    }));

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.studentCourse.findMany({
        where: { studentId, deletedAt: null },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((r) => r.id));

      const payloadIds = new Set(
        normalizedCourses
          .map((c) => c.id)
          .filter((id): id is string => typeof id === 'string'),
      );

      for (const id of payloadIds) {
        if (!existingIds.has(id)) {
          throw new BadRequestException(`课程 id 不属于该学生或已删除：${id}`);
        }
      }

      const toRemove = [...existingIds].filter((id) => !payloadIds.has(id));
      for (const courseId of toRemove) {
        const consumptionCount = await tx.courseConsumption.count({
          where: { studentCourseId: courseId },
        });
        if (consumptionCount > 0) {
          throw new BadRequestException(
            '存在已有消课记录的课程无法从列表中移除，请保留该课程行',
          );
        }
        await tx.studentCourse.update({
          where: { id: courseId },
          data: { deletedAt: new Date() },
        });
      }

      const touched: Prisma.StudentCourseGetPayload<{
        select: {
          id: true;
          studentId: true;
          courseName: true;
          coursePrice: true;
          paidStatus: true;
          totalHours: true;
          remainingHours: true;
          courseType: true;
          remark: true;
          createdAt: true;
          updatedAt: true;
        };
      }>[] = [];

      for (const course of normalizedCourses) {
        if (course.id) {
          const updated = await tx.studentCourse.update({
            where: { id: course.id },
            data: {
              courseName: course.courseName,
              coursePrice: course.coursePrice,
              totalHours: course.totalHours,
              remainingHours: course.remainingHours,
              courseType: course.courseType,
              remark: course.remark,
              paidStatus: course.paidStatus,
            },
            select: {
              id: true,
              studentId: true,
              courseName: true,
              coursePrice: true,
              paidStatus: true,
              totalHours: true,
              remainingHours: true,
              courseType: true,
              remark: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          touched.push(updated);
        } else {
          const created = await tx.studentCourse.create({
            data: {
              studentId,
              courseName: course.courseName,
              coursePrice: course.coursePrice,
              totalHours: course.totalHours,
              remainingHours: course.remainingHours,
              courseType: course.courseType,
              remark: course.remark,
              paidStatus: course.paidStatus,
            },
            select: {
              id: true,
              studentId: true,
              courseName: true,
              coursePrice: true,
              paidStatus: true,
              totalHours: true,
              remainingHours: true,
              courseType: true,
              remark: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          touched.push(created);
        }
      }

      await this.syncStudentMoneyAggregates(tx, studentId);

      return touched;
    });

    await this.operationLogs.create({
      operatorId: user.userId,
      module: 'student_courses',
      action: 'sync_batch',
      targetId: studentId,
      campusId: student.campusId,
      detail: {
        studentId,
        count: result.length,
        courses: result.map((course) => ({
          id: course.id,
          courseName: course.courseName,
          coursePrice: course.coursePrice.toString(),
          paidStatus: course.paidStatus,
          totalHours: course.totalHours.toString(),
          remainingHours: course.remainingHours.toString(),
          courseType: course.courseType,
        })),
      },
    });

    return {
      data: result.map((course) => ({
        ...course,
        coursePrice: course.coursePrice.toString(),
        totalHours: course.totalHours.toString(),
        remainingHours: course.remainingHours.toString(),
      })),
    };
  }

  private async syncStudentMoneyAggregates(tx: TxClient, studentId: string) {
    const agg = await tx.studentCourse.aggregate({
      where: { studentId, deletedAt: null },
      _sum: { coursePrice: true },
    });
    const totalAmount = agg._sum.coursePrice ?? new Prisma.Decimal(0);

    const activeCourses = await tx.studentCourse.findMany({
      where: { studentId, deletedAt: null },
      select: { paidStatus: true },
    });
    const paidStatus =
      activeCourses.length > 0 &&
      activeCourses.every((c) => c.paidStatus === true);

    await tx.student.update({
      where: { id: studentId },
      data: { totalAmount, paidStatus },
    });
  }

  private findAccessibleStudent(user: RequestUser, studentId: string) {
    return this.prisma.student.findFirst({
      where: {
        id: studentId,
        ...this.buildStudentScope(user),
      },
      select: {
        id: true,
        campusId: true,
      },
    });
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
}
