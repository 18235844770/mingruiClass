const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000/api';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'admin123';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  let payload;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }
  if (!response.ok) {
    const detail =
      typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    throw new Error(`${response.status} ${response.statusText} ${path}\n${detail}`);
  }
  return payload;
}

async function requestBinary(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  const buffer = await response.arrayBuffer();
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText} ${path}\n(binary: ${buffer.byteLength} bytes)`,
    );
  }
  return {
    byteLength: buffer.byteLength,
    contentType: response.headers.get('content-type') || '',
  };
}

async function login(loginAccount) {
  const data = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ loginAccount, password: PASSWORD }),
  });
  assert(data?.accessToken, `${loginAccount} 登录未返回 accessToken`);
  return data;
}

function authHeaders(token, campusId) {
  return {
    authorization: `Bearer ${token}`,
    ...(campusId ? { 'x-campus-id': campusId } : {}),
    'content-type': 'application/json',
  };
}

async function main() {
  const salesLogin = await login('13800000002');
  const ownerLogin = await login('13800000003');
  const adminLogin = await login('13800000001');

  const campuses = await request('/campuses/mine', {
    headers: authHeaders(salesLogin.accessToken),
  });
  assert(Array.isArray(campuses), '校区列表返回格式错误');
  assert(campuses.length > 0, 'sales 账号未绑定校区');
  const campusId = campuses[0].id;

  const suffix = Date.now().toString().slice(-8);
  const studentName = `P10-smoke-${suffix}`;

  const createdStudent = await request('/students', {
    method: 'POST',
    headers: authHeaders(salesLogin.accessToken, campusId),
    body: JSON.stringify({
      name: studentName,
      totalAmount: '3000.00',
      paidStatus: true,
      remark: 'phase10 smoke',
    }),
  });
  assert(createdStudent?.id, '创建学生失败：缺少 id');

  await request(`/students/${createdStudent.id}/courses`, {
    method: 'POST',
    headers: authHeaders(salesLogin.accessToken, campusId),
    body: JSON.stringify({
      courses: [
        {
          courseName: `P10-course-${suffix}`,
          coursePrice: '300.00',
          totalHours: '3.0',
          remainingHours: '2.0',
          courseType: '1v1',
          remark: 'phase10 smoke',
        },
      ],
    }),
  });

  const studentDetail = await request(`/students/${createdStudent.id}`, {
    headers: authHeaders(salesLogin.accessToken, campusId),
  });
  assert(
    Array.isArray(studentDetail?.courses) && studentDetail.courses.length > 0,
    '学生详情未返回课程',
  );
  const studentCourseId = studentDetail.courses[0].id;

  await request('/consumptions', {
    method: 'POST',
    headers: authHeaders(salesLogin.accessToken, campusId),
    body: JSON.stringify({
      studentCourseId,
      consumedHours: '1.0',
      consumptionTime: new Date().toISOString(),
      remark: 'phase10 smoke',
      duplicateWarningAcknowledged: true,
    }),
  });

  const lowHoursList = await request('/students?lowHours=true&page=1&pageSize=100', {
    headers: authHeaders(salesLogin.accessToken, campusId),
  });
  assert(Array.isArray(lowHoursList?.data), '低课时列表返回格式错误');
  const hit = lowHoursList.data.find((item) => item.id === createdStudent.id);
  assert(hit, '消课后学生未命中低课时列表');

  const dashboardSummary = await request('/dashboard/summary', {
    headers: authHeaders(ownerLogin.accessToken),
  });
  assert(
    dashboardSummary &&
      dashboardSummary.activeStudents !== undefined &&
      dashboardSummary.totalRemainingHours !== undefined,
    '仪表盘汇总字段不完整',
  );

  const reportsResult = await request(
    '/reports?view=consumption&page=1&pageSize=20&sortBy=consumptionTime&sortOrder=descend',
    {
      headers: authHeaders(ownerLogin.accessToken),
    },
  );
  assert(Array.isArray(reportsResult?.data), '报表列表返回格式错误');

  const excelExport = await requestBinary(
    '/reports/export?format=excel&view=consumption&page=1&pageSize=20',
    {
      headers: authHeaders(ownerLogin.accessToken),
    },
  );
  assert(excelExport.byteLength > 0, 'Excel 导出结果为空');

  const pdfExport = await requestBinary(
    '/reports/export?format=pdf&view=consumption&page=1&pageSize=20',
    {
      headers: authHeaders(ownerLogin.accessToken),
    },
  );
  assert(pdfExport.byteLength > 0, 'PDF 导出结果为空');

  await request(`/students/${createdStudent.id}`, {
    method: 'DELETE',
    headers: authHeaders(salesLogin.accessToken, campusId),
  });

  const logsResult = await request('/logs?page=1&pageSize=50', {
    headers: authHeaders(adminLogin.accessToken),
  });
  assert(Array.isArray(logsResult?.data), '日志列表返回格式错误');
  const targetLogs = logsResult.data.filter(
    (item) => item && item.targetId === createdStudent.id,
  );
  assert(targetLogs.length > 0, '未检索到本次主链路写操作日志');

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: 'phase10-core-chain',
        createdStudentId: createdStudent.id,
        campusId,
        checks: [
          'sales login',
          'sales campus bind',
          'create student',
          'create course',
          'create consumption',
          'low-hours linkage',
          'owner dashboard summary',
          'owner reports list',
          'owner export excel/pdf',
          'cleanup student',
          'admin logs trace',
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
