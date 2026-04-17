import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000/api';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'admin123';
const OUTPUT_DIR = resolve(process.cwd(), 'tmp');
const PDF_FILE = resolve(OUTPUT_DIR, 'reports-sample.pdf');
const CONTEXT_FILE = resolve(OUTPUT_DIR, 'reports-sample-context.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText} ${path}\n${JSON.stringify(payload, null, 2)}`,
    );
  }
  return payload;
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
  const payload = await requestJson('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ loginAccount, password: PASSWORD }),
  });
  assert(payload?.accessToken, `${loginAccount} 登录失败：缺少 accessToken`);
  return payload.accessToken;
}

function authHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

async function main() {
  const ownerToken = await login('13800000003');
  const filters = await requestJson('/reports/filters', {
    headers: authHeaders(ownerToken),
  });
  assert(Array.isArray(filters?.campuses) && filters.campuses.length > 0, '没有可用校区');
  const campusId = filters.campuses[0].id;

  const query =
    `?view=consumption&page=1&pageSize=20&campusId=${campusId}` +
    '&unitPriceSource=average&rounding=round&sortBy=consumptionTime&sortOrder=descend';

  const reports = await requestJson(`/reports${query}`, {
    headers: authHeaders(ownerToken),
  });
  const pdf = await requestBinary(`/reports/export?format=pdf${query.replace('?', '&')}`, {
    headers: authHeaders(ownerToken),
  });
  assert(pdf.byteLength > 0, 'PDF 导出为空');

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(PDF_FILE, pdf);

  const context = {
    campusId,
    query,
    summary: reports.summary,
    firstRows: (reports.data ?? []).slice(0, 5),
    exportedPdfBytes: pdf.byteLength,
  };
  await writeFile(CONTEXT_FILE, `${JSON.stringify(context, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: 'reports-pdf-sample',
        pdfFile: PDF_FILE,
        contextFile: CONTEXT_FILE,
        exportedPdfBytes: pdf.byteLength,
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
