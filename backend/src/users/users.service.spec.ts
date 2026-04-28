import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ROLE_ADMIN } from '../common/constants/role-codes';
import { SUPER_ADMIN_LOGIN_ACCOUNT } from '../common/constants/super-admin';
import { UsersService } from './users.service';

describe('UsersService remove rules', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
  };
  const operationLogs = {
    create: jest.fn(),
  };

  const service = new UsersService(prisma as never, operationLogs as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects deleting self account', async () => {
    await expect(service.remove('u-1', 'u-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('throws when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.remove('u-2', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting super admin login account', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-sa',
      loginAccount: SUPER_ADMIN_LOGIN_ACCOUNT,
      username: '管理员',
      status: 'active',
      role: { code: ROLE_ADMIN },
    });

    await expect(service.remove('u-sa', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting the last admin', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-3',
      loginAccount: '13800000099',
      username: 'admin2',
      status: 'active',
      role: { code: ROLE_ADMIN },
    });
    prisma.role.findUnique.mockResolvedValueOnce({ id: 'role-admin' });
    prisma.user.count.mockResolvedValueOnce(1);

    await expect(service.remove('u-3', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('deletes non-last-admin user and writes log', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-4',
      loginAccount: '13800000088',
      username: 'sales1',
      status: 'active',
      role: { code: 'sales' },
    });
    prisma.user.delete.mockResolvedValueOnce({});
    operationLogs.create.mockResolvedValueOnce({});

    const result = await service.remove('u-4', 'admin-1');
    expect(result).toEqual({ success: true });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u-4' } });
    expect(operationLogs.create).toHaveBeenCalled();
  });
});

describe('UsersService update rules', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    campus: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const operationLogs = {
    create: jest.fn(),
  };

  const service = new UsersService(prisma as never, operationLogs as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects role change for seed super admin', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-sa',
      loginAccount: SUPER_ADMIN_LOGIN_ACCOUNT,
      roleId: 'role-admin-id',
      username: '管理员',
      status: 'active',
      role: { code: ROLE_ADMIN },
      userCampuses: [{ campusId: 'c1' }],
    });

    await expect(
      service.update('u-sa', 'op-1', { roleId: 'role-sales-id' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
