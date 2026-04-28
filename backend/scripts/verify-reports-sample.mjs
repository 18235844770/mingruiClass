import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000/api';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'admin123';

const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toFixed2(value) {
  return Number(value ?? 0).toFixed(2);
}

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText} ${path}\n${JSON.stringify(payload, null, 2)}`,
      );
    }
    return payload;
  }
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${path}\n${text}`);
  }
  return text;
}

async function requestBinary(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${path}`);
  }
  return buffer;
}

async function login(loginAccount) {
  const result = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ loginAccount, password: PASSWORD }),
  });
  assert(result?.accessToken, `${loginAccount} 登录失败：缺少 accessToken`);
  return result.accessToken;
}

function authHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

async function computeDbSummary(campusId) {
  const [activeStudents, studentSum, paidSum, unpaidSum, courseRows] =
    await prisma.$transaction([
    prisma.student.count({
      where: { deletedAt: null, campusId },
    }),
    prisma.student.aggregate({
      where: { deletedAt: null, campusId },
      _sum: { totalAmount: true },
    }),
    prisma.student.aggregate({
      where: { deletedAt: null, campusId, paidStatus: true },
      _sum: { totalAmount: true },
    }),
    prisma.student.aggregate({
      where: { deletedAt: null, campusId, paidStatus: false },
      _sum: { totalAmount: true },
    }),
    prisma.studentCourse.findMany({
      where: {
        deletedAt: null,
        student: { deletedAt: null, campusId },
      },
      select: {
        coursePrice: true,
        totalHours: true,
        remainingHours: true,
      },
    }),
  ]);

  const totalCourseHours = courseRows.reduce(
    (sum, row) => sum + Number(row.totalHours),
    0,
  );
  const totalRemainingHours = courseRows.reduce(
    (sum, row) => sum + Number(row.remainingHours),
    0,
  );

  const unearnedCourseFeeRaw = courseRows.reduce((sum, row) => {
    const hours = Number(row.totalHours);
    const unitPrice = hours > 0 ? Number(row.coursePrice) / hours : 0;
    return sum + round2(Number(row.remainingHours) * unitPrice);
  }, 0);

  return {
    activeStudents,
    totalIncome: toFixed2(studentSum._sum.totalAmount),
    paidTotalAmount: toFixed2(paidSum._sum.totalAmount),
    unpaidTotalAmount: toFixed2(unpaidSum._sum.totalAmount),
    totalCourseHours: toFixed2(totalCourseHours),
    totalRemainingHours: toFixed2(totalRemainingHours),
    unearnedCourseFee: toFixed2(unearnedCourseFeeRaw),
  };
}

async function parseExcelResult(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const summarySheet = workbook.getWorksheet('汇总');
  const detailSheet = workbook.getWorksheet('明细');
  assert(summarySheet, '导出 Excel 缺少“汇总”sheet');
  assert(detailSheet, '导出 Excel 缺少“明细”sheet');

  const readValue = (rowIndex) => {
    const row = summarySheet.getRow(rowIndex);
    const value = row.getCell(2).value;
    if (typeof value === 'number') {
      return toFixed2(value);
    }
    return String(value ?? '');
  };

  const detailRows = [];
  for (let i = 2; i <= detailSheet.rowCount; i += 1) {
    const row = detailSheet.getRow(i);
    const consumptionId = String(row.getCell(1).value ?? '').trim();
    if (!consumptionId) {
      continue;
    }
    detailRows.push(consumptionId);
  }

  return {
    summary: {
      activeStudents: Number(readValue(2)),
      totalCourseHours: readValue(3),
      totalIncome: readValue(4),
      paidTotalAmount: readValue(5),
      unpaidTotalAmount: readValue(6),
      totalRemainingHours: readValue(7),
      unearnedCourseFee: readValue(8),
    },
    detailConsumptionIds: detailRows,
  };
}

async function main() {
  const ownerToken = await login('13800000003');
  const filters = await request('/reports/filters', {
    headers: authHeaders(ownerToken),
  });
  assert(Array.isArray(filters?.campuses) && filters.campuses.length > 0, '没有可用校区样本');
  const campusId = filters.campuses[0].id;

  const query =
    `?view=consumption&page=1&pageSize=20&campusId=${campusId}` +
    '&unitPriceSource=average&rounding=round&sortBy=consumptionTime&sortOrder=descend';

  const apiReports = await request(`/reports${query}`, {
    headers: authHeaders(ownerToken),
  });
  const apiSummary = apiReports.summary;
  assert(apiSummary, '报表接口未返回 summary');

  const dbSummary = await computeDbSummary(campusId);
  assert(
    apiSummary.activeStudents === dbSummary.activeStudents,
    `activeStudents 不一致: api=${apiSummary.activeStudents}, db=${dbSummary.activeStudents}`,
  );
  assert(
    apiSummary.totalRemainingHours === dbSummary.totalRemainingHours,
    `totalRemainingHours 不一致: api=${apiSummary.totalRemainingHours}, db=${dbSummary.totalRemainingHours}`,
  );
  assert(
    apiSummary.totalCourseHours === dbSummary.totalCourseHours,
    `totalCourseHours 不一致: api=${apiSummary.totalCourseHours}, db=${dbSummary.totalCourseHours}`,
  );
  assert(
    apiSummary.totalIncome === dbSummary.totalIncome,
    `totalIncome 不一致: api=${apiSummary.totalIncome}, db=${dbSummary.totalIncome}`,
  );
  assert(
    apiSummary.paidTotalAmount === dbSummary.paidTotalAmount,
    `paidTotalAmount 不一致: api=${apiSummary.paidTotalAmount}, db=${dbSummary.paidTotalAmount}`,
  );
  assert(
    apiSummary.unpaidTotalAmount === dbSummary.unpaidTotalAmount,
    `unpaidTotalAmount 不一致: api=${apiSummary.unpaidTotalAmount}, db=${dbSummary.unpaidTotalAmount}`,
  );
  assert(
    apiSummary.unearnedCourseFee === dbSummary.unearnedCourseFee,
    `unearnedCourseFee 不一致: api=${apiSummary.unearnedCourseFee}, db=${dbSummary.unearnedCourseFee}`,
  );

  const excelBuffer = await requestBinary(
    `/reports/export?format=excel${query.replace('?', '&')}`,
    {
      headers: authHeaders(ownerToken),
    },
  );
  const excelResult = await parseExcelResult(excelBuffer);
  const excelSummary = excelResult.summary;
  assert(
    excelSummary.activeStudents === apiSummary.activeStudents,
    'Excel 汇总 activeStudents 与 API 不一致',
  );
  assert(
    excelSummary.totalRemainingHours === apiSummary.totalRemainingHours,
    'Excel 汇总 totalRemainingHours 与 API 不一致',
  );
  assert(
    excelSummary.totalCourseHours === apiSummary.totalCourseHours,
    'Excel 汇总 totalCourseHours 与 API 不一致',
  );
  assert(
    excelSummary.totalIncome === apiSummary.totalIncome,
    'Excel 汇总 totalIncome 与 API 不一致',
  );
  assert(
    excelSummary.paidTotalAmount === apiSummary.paidTotalAmount,
    'Excel 汇总 paidTotalAmount 与 API 不一致',
  );
  assert(
    excelSummary.unpaidTotalAmount === apiSummary.unpaidTotalAmount,
    'Excel 汇总 unpaidTotalAmount 与 API 不一致',
  );
  assert(
    excelSummary.unearnedCourseFee === apiSummary.unearnedCourseFee,
    'Excel 汇总 unearnedCourseFee 与 API 不一致',
  );

  const apiConsumptionIds = (apiReports.data ?? []).map((row) =>
    String(row.consumptionId ?? ''),
  );
  const exportedTopIds = excelResult.detailConsumptionIds.slice(
    0,
    apiConsumptionIds.length,
  );
  assert(
    JSON.stringify(apiConsumptionIds) === JSON.stringify(exportedTopIds),
    'Excel 明细排序或筛选结果与报表列表不一致',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: 'reports-sample-reconcile',
        campusId,
        checked: [
          'reports summary vs db aggregate',
          'reports unearnedCourseFee vs db aggregate',
          'excel summary vs reports summary',
          'excel detail top rows vs reports list',
        ],
        summary: apiSummary,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
