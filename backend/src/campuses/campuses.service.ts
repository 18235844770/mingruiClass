import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OperationLogsService } from '../logs/operation-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCampusDto } from './dto/create-campus.dto';
import type { ListCampusesQueryDto } from './dto/list-campuses-query.dto';
import type { UpdateCampusDto } from './dto/update-campus.dto';

@Injectable()
export class CampusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogs: OperationLogsService,
  ) {}

  findMine(userId: string) {
    return this.prisma.userCampus.findMany({
      where: { userId },
      include: { campus: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async list(query: ListCampusesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const where = this.buildWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.campus.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campus.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async create(operatorId: string, dto: CreateCampusDto) {
    const created = await this.prisma.campus.create({
      data: {
        name: dto.name.trim(),
        status: dto.status?.trim() || 'active',
      },
    });

    await this.operationLogs.create({
      operatorId,
      module: 'campuses',
      action: 'create',
      targetId: created.id,
      campusId: created.id,
      detail: {
        name: created.name,
        status: created.status,
      },
    });

    return created;
  }

  async update(id: string, operatorId: string, dto: UpdateCampusDto) {
    const existing = await this.prisma.campus.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('校区不存在');
    }

    const payload: Prisma.CampusUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.status !== undefined ? { status: dto.status.trim() } : {}),
    };

    const updated = await this.prisma.campus.update({
      where: { id },
      data: payload,
    });

    await this.operationLogs.create({
      operatorId,
      module: 'campuses',
      action: 'update',
      targetId: updated.id,
      campusId: updated.id,
      detail: {
        before: {
          name: existing.name,
          status: existing.status,
        },
        after: {
          name: updated.name,
          status: updated.status,
        },
      },
    });

    return updated;
  }

  async remove(id: string, operatorId: string) {
    const existing = await this.prisma.campus.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('校区不存在');
    }

    const [studentCount, userBindingCount] = await this.prisma.$transaction([
      this.prisma.student.count({ where: { campusId: id } }),
      this.prisma.userCampus.count({ where: { campusId: id } }),
    ]);

    if (studentCount > 0 || userBindingCount > 0) {
      throw new ConflictException('当前校区已被学生或用户绑定，无法删除');
    }

    await this.prisma.campus.delete({ where: { id } });
    await this.operationLogs.create({
      operatorId,
      module: 'campuses',
      action: 'delete',
      targetId: existing.id,
      detail: {
        name: existing.name,
        status: existing.status,
      },
    });

    return { success: true };
  }

  private buildWhere(query: ListCampusesQueryDto): Prisma.CampusWhereInput {
    const name =
      typeof query.name === 'string' && query.name.trim().length > 0
        ? query.name.trim()
        : undefined;
    const status =
      typeof query.status === 'string' && query.status.trim().length > 0
        ? query.status.trim()
        : undefined;
    return {
      ...(name
        ? {
            name: {
              contains: name,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(status ? { status } : {}),
    };
  }
}
