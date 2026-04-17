/**
 * 人工测试前清空：仅保留超级管理员（种子登录账号）与三种内置角色（admin/sales/owner）。
 * 删除校区、用户校区关联、学生、课程、消课、操作日志及其他用户。
 */
import { SUPER_ADMIN_LOGIN_ACCOUNT } from '../src/common/constants/super-admin';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BUILTIN_ROLE_CODES = [
  { code: 'admin', name: '管理员' },
  { code: 'sales', name: '销售' },
  { code: 'owner', name: '老板' },
] as const;

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.courseConsumption.deleteMany({});
    await tx.studentCourse.deleteMany({});
    await tx.student.deleteMany({});
    await tx.operationLog.deleteMany({});
    await tx.userCampus.deleteMany({});
    await tx.campus.deleteMany({});
    await tx.user.deleteMany({
      where: { loginAccount: { not: SUPER_ADMIN_LOGIN_ACCOUNT } },
    });
  });

  for (const r of BUILTIN_ROLE_CODES) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: { code: r.code, name: r.name },
    });
  }

  const roleAdmin = await prisma.role.findUniqueOrThrow({ where: { code: 'admin' } });
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { loginAccount: SUPER_ADMIN_LOGIN_ACCOUNT },
    update: {
      username: '管理员',
      passwordHash,
      roleId: roleAdmin.id,
      status: 'active',
    },
    create: {
      loginAccount: SUPER_ADMIN_LOGIN_ACCOUNT,
      username: '管理员',
      passwordHash,
      roleId: roleAdmin.id,
      status: 'active',
    },
  });

  const counts = {
    roles: await prisma.role.count(),
    users: await prisma.user.count(),
    campuses: await prisma.campus.count(),
    students: await prisma.student.count(),
  };

  console.log('Reset for manual test OK:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
