import { request } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

/**
 * E2E 전역 셋업 — 로컬 환경을 자동 프로비저닝한다.
 *
 *  1. backend(:4000) 헬스 체크 (없으면 명확한 에러로 즉시 실패)
 *  2. 테스트 계정(e2etester/Test1234!) 생성 — 이미 있으면 무시
 *  3. component 시드 확인 → 비어 있으면 backend-api `npm run seed` 실행
 *  4. 'sales' 데이터 소스 확인 → 없으면 생성된 CSV를 /v1/database/upload로 업로드
 *  5. 브라우저 파일 분석용 픽스처(CSV/JSON/Parquet)를 e2e/fixtures/generated/에 생성
 *
 * 환경변수로 덮어쓸 수 있다:
 *   E2E_API_URL  (기본 http://localhost:4000/v1)
 *   E2E_USER_ID / E2E_PASSWORD (기본 e2etester / Test1234!)
 */

// 후행 슬래시 필수 — 없으면 상대경로 결합 시 'v1'이 잘린다
const API = (process.env.E2E_API_URL ?? 'http://localhost:4000/v1') + '/';
const USER = {
  userId: process.env.E2E_USER_ID ?? 'e2etester',
  password: process.env.E2E_PASSWORD ?? 'Test1234!',
};
const BACKEND_DIR = path.resolve(__dirname, '../../backend-api');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'generated');

export const FIXTURES = {
  salesCsv: path.join(FIXTURE_DIR, 'sales.csv'),
  sensorsJson: path.join(FIXTURE_DIR, 'sensors.json'),
  usersParquet: path.join(FIXTURE_DIR, 'users.parquet'),
};

async function waitForBackend(api: Awaited<ReturnType<typeof request.newContext>>) {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      // 어떤 응답이든(401 포함) 서버가 살아있음을 의미
      await api.get('component');
      return;
    } catch (e) {
      if (Date.now() > deadline) {
        throw new Error(
          `[e2e] 백엔드가 ${API}에서 응답하지 않습니다. backend-api에서 서버를 먼저 띄워주세요. (${String(e)})`,
        );
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

function generateSalesCsv(): string {
  const cats = ['전자제품', '의류', '식품', '가구', '도서'];
  const regions = ['서울', '부산', '대구', '인천', '광주'];
  const rows = ['id,category,region,amount,qty,sale_date'];
  for (let i = 1; i <= 500; i++) {
    rows.push(
      `${i},${cats[i % 5]},${regions[i % 5]},${((i * 137) % 1000) + 100},${(i % 9) + 1},2025-${String((i % 12) + 1).padStart(
        2,
        '0',
      )}-${String((i % 28) + 1).padStart(2, '0')}`,
    );
  }
  return rows.join('\n');
}

function generateSensorsJson(): string {
  const rows = Array.from({ length: 300 }, (_, i) => ({
    sensor_id: `S${(i % 20) + 1}`,
    temperature: Math.round((15 + (i % 30) * 0.7) * 10) / 10,
    humidity: 30 + (i % 50),
    site: ['A동', 'B동', 'C동'][i % 3],
    ts: `2025-08-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z`,
  }));
  return JSON.stringify(rows, null, 0);
}

function generateParquet(outFile: string) {
  // parquetjs-lite는 backend-api 의존성 — 거기서 resolve해서 사용
  const backendRequire = createRequire(path.join(BACKEND_DIR, 'package.json'));
  const parquet = backendRequire('parquetjs-lite');
  const schema = new parquet.ParquetSchema({
    id: { type: 'INT32' },
    name: { type: 'UTF8' },
    age: { type: 'INT32' },
    city: { type: 'UTF8' },
    score: { type: 'DOUBLE' },
  });
  return (async () => {
    const writer = await parquet.ParquetWriter.openFile(schema, outFile);
    for (let i = 1; i <= 200; i++) {
      await writer.appendRow({
        id: i,
        name: `user_${i}`,
        age: 20 + (i % 40),
        city: ['Seoul', 'Busan', 'Daegu'][i % 3],
        score: Math.round((i * 3.7) % 1000) / 10,
      });
    }
    await writer.close();
  })();
}

async function ensureFixtures() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  if (!fs.existsSync(FIXTURES.salesCsv)) fs.writeFileSync(FIXTURES.salesCsv, generateSalesCsv());
  if (!fs.existsSync(FIXTURES.sensorsJson)) fs.writeFileSync(FIXTURES.sensorsJson, generateSensorsJson());
  if (!fs.existsSync(FIXTURES.usersParquet)) await generateParquet(FIXTURES.usersParquet);
}

export default async function globalSetup() {
  if (process.env.QA_RUN_ROOT) {
    USER.userId = USER.userId.replace(/_/g, '');
    process.env.E2E_USER_ID = USER.userId;
  }
  const api = await request.newContext({ baseURL: API });
  await waitForBackend(api);
  console.log(`[e2e setup] backend OK (${API})`);

  // 1) 테스트 계정 — 중복 가입 에러는 무시
  const signup = await api.post('login/signup', {
    data: {
      userId: USER.userId,
      password: USER.password,
      email: process.env.QA_RUN_ROOT ? `${USER.userId}@example.test` : 'e2e@test.com',
    },
  });
  console.log(`[e2e setup] signup → ${signup.status()}`);

  const signin = await api.post('login/signin', {
    data: { userId: USER.userId, password: USER.password },
  });
  if (!signin.ok()) {
    throw new Error(`[e2e] 테스트 계정 로그인 실패: ${signin.status()} ${await signin.text()}`);
  }
  const { accessToken } = await signin.json();
  const auth = { Authorization: `Bearer ${accessToken}` };

  // 2) 차트 컴포넌트 시드 — 없으면 backend-api npm run seed 실행
  const compRes = await api.get('component', { headers: auth });
  const components = await compRes.json().catch(() => []);
  if (!Array.isArray(components) || components.length === 0) {
    if (process.env.E2E_EXTERNAL_SERVER === '1') {
      throw new Error(
        '[e2e] 외부 서버의 차트 컴포넌트가 비어 있습니다. 해당 서버 DB에 시드를 준비하세요. 기본 로컬 DB에는 시드하지 않습니다.',
      );
    }
    console.log('[e2e setup] component 시드가 없음 → backend-api npm run seed 실행');
    execFileSync('npm', ['run', 'seed'], {
      cwd: BACKEND_DIR,
      env: { ...process.env, NODE_ENV: 'local' },
      stdio: 'inherit',
    });
    const recheck = await api.get('component', { headers: auth });
    const list = await recheck.json().catch(() => []);
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error('[e2e] seed 실행 후에도 /v1/component가 비어 있습니다.');
    }
  }
  console.log('[e2e setup] components OK');

  // 3) 'sales' 업로드 데이터 소스 — 없으면 CSV 업로드로 생성
  const dbRes = await api.get('database', { headers: auth });
  const dbJson = await dbRes.json().catch(() => ({}));
  const databases: any[] = dbJson.data ?? dbJson ?? [];
  const hasSales = databases.some((d: any) => String(d.name).toLowerCase() === 'sales');
  if (!hasSales) {
    const csv = Buffer.from(generateSalesCsv());
    const up = await api.post('database/upload', {
      headers: auth,
      multipart: { file: { name: 'sales.csv', mimeType: 'text/csv', buffer: csv } },
    });
    if (!up.ok()) {
      throw new Error(`[e2e] sales.csv 업로드 실패: ${up.status()} ${await up.text()}`);
    }
    console.log('[e2e setup] sales 데이터 소스 업로드 완료');
  } else {
    console.log('[e2e setup] sales 데이터 소스 이미 존재');
  }

  // 4) 브라우저 파일 분석 픽스처 생성
  await ensureFixtures();
  console.log(`[e2e setup] fixtures OK (${FIXTURE_DIR})`);

  if (process.env.QA_RUN_ROOT && process.env.QA_EVIDENCE_DIR && process.env.QA_CAPTURE_INVENTORY === '1') {
    const inventory = await api.get('component', { headers: auth });
    const widgets = await api.get('widget', { headers: auth });
    const widgetData = await widgets.json();
    fs.writeFileSync(
      path.join(process.env.QA_EVIDENCE_DIR, 'components.json'),
      JSON.stringify(await inventory.json(), null, 2),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      path.join(process.env.QA_EVIDENCE_DIR, 'seed-widget-options.json'),
      JSON.stringify(
        widgetData.data.filter((w: any) => w.id <= 100),
        null,
        2,
      ),
      { mode: 0o600 },
    );
  }
  await api.dispose();
}
