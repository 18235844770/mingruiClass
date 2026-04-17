import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { ROLE_ADMIN } from '../common/constants/role-codes';
import { SUPER_ADMIN_LOGIN_ACCOUNT } from '../common/constants/super-admin';
import { OperationLogsService } from '../logs/operation-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogs: OperationLogsService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;
    const where = this.buildWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          role: { select: { id: true, code: true, name: true } },
          userCampuses: {
            include: {
              campus: { select: { id: true, name: true, status: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.formatUser(row)),
      total,
      page,
      pageSize,
    };
  }

  async detail(id: string) {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: { select: { id: true, code: true, name: true } },
        userCampuses: {
          include: {
            campus: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('用户不存在');
    }
    return this.formatUser(row);
  }

  async create(operatorId: string, dto: CreateUserDto) {
    const loginAccount = dto.loginAccount.trim();
    const username = dto.username.trim();
    const existsAccount = await this.prisma.user.findUnique({
      where: { loginAccount },
    });
    if (existsAccount) {
      throw new ConflictException('该登录账号已存在');
    }

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) {
      throw new BadRequestException('角色不存在');
    }

    if (dto.campusIds && dto.campusIds.length > 0) {
      await this.assertCampusesExist(dto.campusIds);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.user.create({
      data: {
        loginAccount,
        username,
        passwordHash,
        roleId: dto.roleId,
        status: dto.status?.trim() || 'active',
        userCampuses:
          dto.campusIds && dto.campusIds.length > 0
            ? {
                create: dto.campusIds.map((campusId) => ({ campusId })),
              }
            : undefined,
      },
      include: {
        role: { select: { id: true, code: true, name: true } },
        userCampuses: {
          include: {
            campus: { select: { id: true, name: true, status: true } },
          },
        },
      },
    });

    await this.operationLogs.create({
      operatorId,
      module: 'users',
      action: 'create',
      targetId: created.id,
      detail: {
        loginAccount: created.loginAccount,
        username: created.username,
        role: created.role.code,
        status: created.status,
        campusIds: created.userCampuses.map((uc) => uc.campusId),
      },
    });

    return this.formatUser(created);
  }

  async update(id: string, operatorId: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: { select: { code: true } },
        userCampuses: { select: { campusId: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('用户不存在');
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException('角色不存在');
      }
    }
    if (dto.campusIds) {
      await this.assertCampusesExist(dto.campusIds);
    }

    let nextLoginAccount: string | undefined;
    if (dto.loginAccount !== undefined) {
      nextLoginAccount = dto.loginAccount.trim();
      const conflict = await this.prisma.user.findFirst({
        where: { loginAccount: nextLoginAccount, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException('该登录账号已被其他用户使用');
      }
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.campusIds) {
        await tx.userCampus.deleteMany({ where: { userId: id } });
        if (dto.campusIds.length > 0) {
          await tx.userCampus.createMany({
            data: dto.campusIds.map((campusId) => ({ userId: id, campusId })),
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          ...(nextLoginAccount !== undefined
            ? { loginAccount: nextLoginAccount }
            : {}),
          ...(dto.username !== undefined
            ? { username: dto.username.trim() }
            : {}),
          ...(dto.roleId ? { roleId: dto.roleId } : {}),
          ...(dto.status !== undefined ? { status: dto.status.trim() } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        },
        include: {
          role: { select: { id: true, code: true, name: true } },
          userCampuses: {
            include: {
              campus: { select: { id: true, name: true, status: true } },
            },
          },
        },
      });
    });

    await this.operationLogs.create({
      operatorId,
      module: 'users',
      action: 'update',
      targetId: updated.id,
      detail: {
        before: {
          role: existing.role.code,
          status: existing.status,
          campusIds: existing.userCampuses.map((uc) => uc.campusId),
        },
        after: {
          role: updated.role.code,
          status: updated.status,
          campusIds: updated.userCampuses.map((uc) => uc.campusId),
          resetPassword: Boolean(dto.password),
        },
      },
    });

    return this.formatUser(updated);
  }

  async remove(id: string, operatorId: string) {
    if (id === operatorId) {
      throw new BadRequestException('不能删除当前登录用户');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        role: { select: { code: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('用户不存在');
    }

    if (existing.loginAccount === SUPER_ADMIN_LOGIN_ACCOUNT) {
      throw new BadRequestException('超级管理员账号不可删除');
    }

    if (existing.role.code === ROLE_ADMIN) {
      const adminRole = await this.prisma.role.findUnique({
        where: { code: ROLE_ADMIN },
      });
      if (adminRole) {
        const adminCount = await this.prisma.user.count({
          where: { roleId: adminRole.id },
        });
        if (adminCount <= 1) {
          throw new BadRequestException('系统至少保留一个管理员账号');
        }
      }
    }

    await this.prisma.user.delete({ where: { id } });

    await this.operationLogs.create({
      operatorId,
      module: 'users',
      action: 'delete',
      targetId: existing.id,
      detail: {
        loginAccount: existing.loginAccount,
        username: existing.username,
        role: existing.role.code,
        status: existing.status,
      },
    });

    return { success: true };
  }

  private buildWhere(query: ListUsersQueryDto): Prisma.UserWhereInput {
    const q =
      typeof query.username === 'string' && query.username.trim().length > 0
        ? query.username.trim()
        : undefined;
    const status =
      typeof query.status === 'string' && query.status.trim().length > 0
        ? query.status.trim()
        : undefined;
    return {
      ...(q
        ? {
            OR: [
              {
                username: {
                  contains: q,
                  mode: 'insensitive',
                },
              },
              { loginAccount: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(status ? { status } : {}),
      ...(query.campusId
        ? {
            userCampuses: {
              some: { campusId: query.campusId },
            },
          }
        : {}),
    };
  }

  private async assertCampusesExist(campusIds: string[]) {
    if (campusIds.length === 0) {
      return;
    }
    const count = await this.prisma.campus.count({
      where: { id: { in: campusIds } },
    });
    if (count !== campusIds.length) {
      throw new BadRequestException('存在无效的校区 ID');
    }
  }

  private formatUser(row: {
    id: string;
    loginAccount: string;
    username: string;
    roleId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    role: { id: string; code: string; name: string | null };
    userCampuses: Array<{
      campusId: string;
      campus: { id: string; name: string; status: string };
    }>;
  }) {
    return {
      id: row.id,
      loginAccount: row.loginAccount,
      username: row.username,
      roleId: row.roleId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      role: row.role,
      campuses: row.userCampuses.map((uc) => uc.campus),
      campusIds: row.userCampuses.map((uc) => uc.campusId),
    };
  }
}
