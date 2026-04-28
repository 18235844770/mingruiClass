import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ListLogsQueryDto } from './dto/list-logs-query.dto';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async listOperators() {
    const logs = await this.prisma.operationLog.findMany({
      where: { deletedAt: null },
      distinct: ['operatorId'],
      orderBy: { createdAt: 'desc' },
      select: {
        operator: {
          select: { id: true, username: true },
        },
      },
    });
    return logs
      .map((item) => item.operator)
      .filter((op): op is { id: string; username: string } => op != null)
      .filter(
        (item, index, arr) => arr.findIndex((v) => v.id === item.id) === index,
      );
  }

  async list(query: ListLogsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const where = this.buildWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.operationLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          operator: {
            select: { id: true, username: true },
          },
          campus: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.operationLog.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async detail(id: string) {
    const row = await this.prisma.operationLog.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        operator: {
          select: { id: true, username: true },
        },
        campus: {
          select: { id: true, name: true },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('日志不存在');
    }
    return row;
  }

  async remove(id: string) {
    const existing = await this.prisma.operationLog.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('日志不存在');
    }
    await this.prisma.operationLog.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  private buildWhere(query: ListLogsQueryDto): Prisma.OperationLogWhereInput {
    const createdAt =
      query.startTime || query.endTime
        ? {
            ...(query.startTime ? { gte: new Date(query.startTime) } : {}),
            ...(query.endTime ? { lte: new Date(query.endTime) } : {}),
          }
        : undefined;

    return {
      deletedAt: null,
      ...(query.operatorId ? { operatorId: query.operatorId } : {}),
      ...(query.module ? { module: query.module.trim() } : {}),
      ...(query.campusId ? { campusId: query.campusId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  }
}
