const BASE = 'http://localhost:3000/api';

async function request(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function login(loginAccount, password = 'admin123') {
  const res = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginAccount, password }),
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Login failed for ${loginAccount}: ${res.status}`);
  }
  return res.data.accessToken;
}

async function getMine(token) {
  const res = await request('/campuses/mine', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) {
    throw new Error(`GET /campuses/mine failed: ${res.status}`);
  }
  return res.data;
}

async function getStudents(token, campusId) {
  const headers = { Authorization: `Bearer ${token}` };
  if (campusId) {
    headers['X-Campus-Id'] = campusId;
  }
  return request('/students', { headers });
}

async function getWithToken(path, token) {
  return request(path, { headers: { Authorization: `Bearer ${token}` } });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function main() {
  const results = [];

  const adminToken = await login('13800000001');
  const ownerToken = await login('13800000003');
  const salesAToken = await login('13900000001');
  const salesBToken = await login('13900000002');

  const salesAMine = await getMine(salesAToken);
  const salesBMine = await getMine(salesBToken);

  const c1 = salesBMine[0]?.id;
  const c2 = salesAMine.find((c) => c.id !== c1 && isUuid(c.id))?.id;
  assert(c1, 'sales_b has no campus binding');
  assert(c2, 'sales_a has no second campus binding');

  // 4.8.1: sales A cannot see sales B students in same campus
  const salesAInC1 = await getStudents(salesAToken, c1);
  const salesBInC1 = await getStudents(salesBToken, c1);
  assert(salesAInC1.status === 200, 'sales_a list C1 should be 200');
  assert(salesBInC1.status === 200, 'sales_b list C1 should be 200');
  const namesA = (salesAInC1.data.items || []).map((x) => x.name);
  const namesB = (salesBInC1.data.items || []).map((x) => x.name);
  assert(namesA.includes('自检学生-A-C1'), 'sales_a should see 自检学生-A-C1');
  assert(!namesA.includes('自检学生-B-C1'), 'sales_a should not see 自检学生-B-C1');
  assert(namesB.includes('自检学生-B-C1'), 'sales_b should see 自检学生-B-C1');
  assert(!namesB.includes('自检学生-A-C1'), 'sales_b should not see 自检学生-A-C1');
  results.push({ item: '销售A/B created_by 隔离', pass: true });

  // 4.8.2: sales campus switch isolation
  const salesAInC2 = await getStudents(salesAToken, c2);
  assert(salesAInC2.status === 200, 'sales_a list C2 should be 200');
  const namesA2 = (salesAInC2.data.items || []).map((x) => x.name);
  assert(namesA2.includes('自检学生-A-C2'), 'sales_a should see 自检学生-A-C2 in C2');
  assert(!namesA2.includes('自检学生-A-C1'), 'sales_a should not see 自检学生-A-C1 in C2');
  results.push({ item: '销售切校区隔离', pass: true });

  // sales guard campus header required
  const salesNoCampus = await getStudents(salesAToken);
  assert(salesNoCampus.status === 400, 'sales without campus header should be 400');
  results.push({ item: '销售必须携带 X-Campus-Id', pass: true });

  // 4.8.3 owner read-only capabilities
  const ownerDashboard = await getWithToken('/dashboard/summary', ownerToken);
  const ownerReports = await getWithToken('/reports', ownerToken);
  const ownerLogs = await getWithToken('/logs', ownerToken);
  const ownerStudents = await getStudents(ownerToken, c1);
  assert(ownerDashboard.status === 200, 'owner dashboard should be 200');
  assert(ownerReports.status === 200, 'owner reports should be 200');
  assert(ownerLogs.status === 200, 'owner logs should be 200');
  assert(ownerStudents.status === 403, 'owner students should be 403');
  results.push({ item: '老板只读能力与写入限制', pass: true });

  // 4.8.4 admin config capabilities
  const adminUsers = await getWithToken('/users', adminToken);
  const adminRoles = await getWithToken('/roles', adminToken);
  const adminDashboard = await getWithToken('/dashboard/summary', adminToken);
  assert(adminUsers.status === 200, 'admin users should be 200');
  assert(adminRoles.status === 200, 'admin roles should be 200');
  assert(adminDashboard.status === 403, 'admin dashboard should be 403 in phase4');
  results.push({ item: '管理员系统配置能力', pass: true });

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
  process.exit(1);
});
