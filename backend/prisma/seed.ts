import { SUPER_ADMIN_LOGIN_ACCOUNT } from '../src/common/constants/super-admin';
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_LOGIN_ADMIN = SUPER_ADMIN_LOGIN_ACCOUNT;
const SEED_LOGIN_SALES = '13800000002';
const SEED_LOGIN_OWNER = '13800000003';

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  const roleAdmin = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: { code: 'admin', name: '管理员' },
  });

  const roleSales = await prisma.role.upsert({
    where: { code: 'sales' },
    update: {},
    create: { code: 'sales', name: '销售' },
  });

  const roleOwner = await prisma.role.upsert({
    where: { code: 'owner' },
    update: {},
    create: { code: 'owner', name: '老板' },
  });

  let campus = await prisma.campus.findFirst();
  if (!campus) {
    campus = await prisma.campus.create({
      data: { name: '示例校区', status: 'active' },
    });
  }

  const admin = await prisma.user.upsert({
    where: { loginAccount: SEED_LOGIN_ADMIN },
    update: {
      username: '管理员',
      passwordHash,
      roleId: roleAdmin.id,
      status: 'active',
    },
    create: {
      loginAccount: SEED_LOGIN_ADMIN,
      username: '管理员',
      passwordHash,
      roleId: roleAdmin.id,
      status: 'active',
    },
  });

  const sales = await prisma.user.upsert({
    where: { loginAccount: SEED_LOGIN_SALES },
    update: {
      username: '演示销售',
      passwordHash,
      roleId: roleSales.id,
      status: 'active',
    },
    create: {
      loginAccount: SEED_LOGIN_SALES,
      username: '演示销售',
      passwordHash,
      roleId: roleSales.id,
      status: 'active',
    },
  });

  const owner = await prisma.user.upsert({
    where: { loginAccount: SEED_LOGIN_OWNER },
    update: {
      username: '演示老板',
      passwordHash,
      roleId: roleOwner.id,
      status: 'active',
    },
    create: {
      loginAccount: SEED_LOGIN_OWNER,
      username: '演示老板',
      passwordHash,
      roleId: roleOwner.id,
      status: 'active',
    },
  });

  await prisma.userCampus.upsert({
    where: {
      userId_campusId: {
        userId: sales.id,
        campusId: campus.id,
      },
    },
    update: {},
    create: {
      userId: sales.id,
      campusId: campus.id,
    },
  });

  // 3.6 演示数据：1 名学生 + 1 门课程 + 1 条消课（幂等）
  let demoStudent = await prisma.student.findFirst({
    where: {
      campusId: campus.id,
      name: '演示学生',
      deletedAt: null,
    },
  });
  if (!demoStudent) {
    demoStudent = await prisma.student.create({
      data: {
        name: '演示学生',
        phone: null,
        grade: '三年级',
        gender: '男',
        totalAmount: new Prisma.Decimal('0'),
        paidStatus: false,
        remark: '种子演示数据',
        campusId: campus.id,
        createdBy: sales.id,
      },
    });
  }

  let demoCourse = await prisma.studentCourse.findFirst({
    where: {
      studentId: demoStudent.id,
      courseName: '演示课程',
      deletedAt: null,
    },
  });
  if (!demoCourse) {
    demoCourse = await prisma.studentCourse.create({
      data: {
        studentId: demoStudent.id,
        courseName: '演示课程',
        coursePrice: new Prisma.Decimal('5000.00'),
        paidStatus: true,
        totalHours: new Prisma.Decimal('10'),
        remainingHours: new Prisma.Decimal('6'),
        courseType: '1v1',
        remark: '种子演示',
      },
    });
    await prisma.student.update({
      where: { id: demoStudent.id },
      data: {
        totalAmount: new Prisma.Decimal('5000.00'),
        paidStatus: true,
      },
    });
  }

  const existingConsumption = await prisma.courseConsumption.findFirst({
    where: {
      studentCourseId: demoCourse.id,
      remark: '种子演示消课',
    },
  });
  if (!existingConsumption) {
    await prisma.courseConsumption.create({
      data: {
        studentCourseId: demoCourse.id,
        consumedHours: new Prisma.Decimal('2'),
        consumptionTime: new Date('2026-04-01T10:00:00.000Z'),
        operatorId: sales.id,
        remark: '种子演示消课',
      },
    });
  }

  console.log('Seed OK:', {
    admin: { login: admin.loginAccount, name: admin.username },
    sales: { login: sales.loginAccount, name: sales.username },
    owner: { login: owner.loginAccount, name: owner.username },
    campus: campus.name,
    roles: [roleAdmin.code, roleSales.code, roleOwner.code],
    demo: { student: demoStudent.name, course: demoCourse.courseName },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
