import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { OperationLogsService } from '../logs/operation-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { ListRolesQueryDto } from './dto/list-roles-query.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogs: OperationLogsService,
  ) {}

  async list(query: ListRolesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const where = this.buildWhere(query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.role.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async create(operatorId: string, dto: CreateRoleDto) {
    const code = dto.code.trim().toLowerCase();
    const name = dto.name?.trim() || null;
    const exists = await this.prisma.role.findUnique({ where: { code } });
    if (exists) {
      throw new ConflictException('角色编码已存在');
    }
    const created = await this.prisma.role.create({
      data: { code, name },
    });

    await this.operationLogs.create({
      operatorId,
      module: 'roles',
      action: 'create',
      targetId: created.id,
      detail: { code: created.code, name: created.name },
    });

    return created;
  }

  async update(id: string, operatorId: string, dto: UpdateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('角色不存在');
    }

    const nextCode = dto.code?.trim().toLowerCase();
    if (nextCode && nextCode !== existing.code) {
      const duplicated = await this.prisma.role.findUnique({
        where: { code: nextCode },
      });
      if (duplicated) {
        throw new ConflictException('角色编码已存在');
      }
    }

    const data: Prisma.RoleUpdateInput = {
      ...(nextCode ? { code: nextCode } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() || null } : {}),
    };
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data,
    });

    await this.operationLogs.create({
      operatorId,
      module: 'roles',
      action: 'update',
      targetId: updated.id,
      detail: {
        before: { code: existing.code, name: existing.name },
        after: { code: updated.code, name: updated.name },
      },
    });

    return updated;
  }

  async remove(id: string, operatorId: string) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('角色不存在');
    }

    const userCount = await this.prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new ConflictException('该角色已有用户使用，无法删除');
    }

    await this.prisma.role.delete({ where: { id } });

    await this.operationLogs.create({
      operatorId,
      module: 'roles',
      action: 'delete',
      targetId: existing.id,
      detail: { code: existing.code, name: existing.name },
    });

    return { success: true };
  }

  private buildWhere(query: ListRolesQueryDto): Prisma.RoleWhereInput {
    const code =
      typeof query.code === 'string' && query.code.trim().length > 0
        ? query.code.trim().toLowerCase()
        : undefined;
    const name =
      typeof query.name === 'string' && query.name.trim().length > 0
        ? query.name.trim()
        : undefined;
    return {
      ...(code
        ? {
            code: {
              contains: code,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(name
        ? {
            name: {
              contains: name,
              mode: 'insensitive',
            },
          }
        : {}),
    };
  }
}
