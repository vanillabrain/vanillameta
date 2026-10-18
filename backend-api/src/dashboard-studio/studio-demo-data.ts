/**
 * VM 소유 합성 데모 데이터. 공식 Rill 샘플도, 실제 고객 데이터도 아니다.
 *
 * - margin: 비용·매출·이익 fixture. `profit`은 행마다 함께 적재하는 원시 fixture 열이며
 *   VM의 저장 지표식(제한된 계산 AST) 구현이 아니다. 따라서 `RATIO_SUM(profit, revenue)`
 *   같은 구조화 비율 지표가 올바른 마진을 재현하는지 확인하는 입력으로 먼저 쓸 수 있다(RXS-03 이전).
 * - funnel: 방문→다운로드→가입 전환을 담은 평탄화(flattened) 집계 fixture.
 * - 두 fixture 모두 2025-01 두 주 구간의 결정적 고정 행이며, DuckDB가 TIMESTAMP로 추론하는
 *   ISO 타임스탬프 날짜 열을 가진다. 값은 전부 하드코딩이며 런타임 난수·현재 시각에 의존하지 않는다.
 */

export type StudioDemoSampleId =
  | 'margin'
  | 'funnel'
  | 'margin-reuse'
  | 'margin-missing'
  | 'margin-krw';

/** RFC 4180 규칙으로 쉼표·큰따옴표·줄바꿈이 든 값을 감싼다. */
const quoteCsvField = (value: string) =>
  /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;

const toCsv = (header: string[], rows: string[][]) =>
  Buffer.from(
    [header, ...rows].map(row => row.map(quoteCsvField).join(',')).join('\n') + '\n',
    'utf8',
  );

/** 2자리 소수를 센트 정수로 바꿔 부동소수 오차와 NaN을 만들지 않는다. */
const cents = (value: string) => {
  const match = /^(-?)([0-9]+)\.([0-9]{2})$/.exec(value);
  if (!match) throw new Error('fixture money value must use two decimals: ' + value);
  const amount = Number(match[2]) * 100 + Number(match[3]);
  return match[1] === '-' ? -amount : amount;
};

const money = (value: number) => {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  return sign + Math.floor(absolute / 100) + '.' + String(absolute % 100).padStart(2, '0');
};

/** 날짜 열은 매일 09:00 배치 스냅샷을 뜻하는 ISO 8601 타임스탬프이며 DuckDB가 TIMESTAMP로 추론한다. */
const SNAPSHOT_TIME = 'T09:00:00';

const MARGIN_HEADER = [
  'day',
  'company',
  'plan',
  'location',
  'environment',
  'component',
  'sku',
  'pipeline',
  'currency',
  'revenue',
  'cost',
  'profit',
];

/** 원시 행: [day, company, plan, location, environment, component, sku, pipeline, revenue, cost] */
// prettier-ignore
const MARGIN_ROWS: string[][] = [
  ['2025-01-06', 'Hanul Foods', 'Enterprise', 'Seoul', 'production', 'Compute', 'C-100', 'ingest-a', '1200.00', '900.00'],
  ['2025-01-07', 'Hanul Foods', 'Enterprise', 'Seoul', 'production', 'Storage', 'S-200', 'ingest-a', '800.00', '1000.00'],
  ['2025-01-08', 'Baro Tech', 'Growth', 'Busan', 'staging', 'Compute', 'C-100', 'ingest-b', '0.00', '150.00'],
  ['2025-01-09', 'Baro Tech', 'Growth', 'Busan', 'production', 'Compute', 'C-300', 'ingest-b', '640.50', '512.40'],
  ['2025-01-10', 'Cheonji Retail', 'Enterprise', 'Incheon', 'production', 'Query', 'Q-100', 'analytics', '2100.00', '1575.00'],
  ['2025-01-11', 'Cheonji Retail', 'Enterprise', 'Incheon', 'production', 'Storage', 'S-200', 'analytics', '310.25', '279.20'],
  ['2025-01-12', 'Danbi Labs', 'Starter', 'Daegu', 'development', 'Compute', 'C-100', 'ingest-c', '99.99', '79.99'],
  ['2025-01-12', 'Danbi Labs', 'Starter', 'Daegu', 'staging', 'Compute', 'C-400', 'ingest-c', '150.00', '150.00'],
  ['2025-01-13', 'Hanul Foods', 'Enterprise', 'Seoul', 'production', 'Compute', 'C-100', 'ingest-a', '1320.00', '990.00'],
  ['2025-01-14', 'Hanul Foods', 'Enterprise', 'Seoul', 'production', 'Compute', 'C-300', 'ingest-a', '940.00', '1128.00'],
  ['2025-01-15', 'Baro Tech', 'Growth', 'Busan', 'production', 'Storage', 'S-200', 'ingest-b', '530.75', '398.06'],
  ['2025-01-15', 'Baro Tech', 'Growth', 'Busan', 'development', 'Compute', 'C-100', 'ingest-b', '0.00', '60.00'],
  ['2025-01-16', 'Cheonji Retail', 'Enterprise', 'Incheon', 'production', 'Query', 'Q-100', 'analytics', '2450.00', '1715.00'],
  ['2025-01-17', 'Cheonji Retail', 'Enterprise', 'Incheon', 'production', 'Query', 'Q-200', 'analytics', '1890.40', '1417.80'],
  ['2025-01-17', 'Danbi Labs', 'Starter', 'Daegu', 'development', 'Compute', 'C-400', 'ingest-c', '210.10', '189.09'],
  ['2025-01-18', 'Samil Trading, Inc.', 'Enterprise', 'Seoul', 'production', 'Storage', 'S-200', 'ingest-d', '1600.00', '1200.00'],
  ['2025-01-18', 'Samil Trading, Inc.', 'Enterprise', 'Seoul', 'production', 'Storage', 'S-300', 'ingest-d', '275.50', '220.40'],
  ['2025-01-19', 'Danbi "Prime" Labs', 'Starter', 'Daegu', 'staging', 'Compute', 'C-100', 'ingest-c', '420.00', '315.00'],
];

const FUNNEL_HEADER = [
  'date',
  'version',
  'country',
  'device',
  'new_existing',
  'visits',
  'downloads',
  'signups',
];

/** 원시 행: [date, version, country, device, new_existing, visits, downloads, signups] */
// prettier-ignore
const FUNNEL_ROWS: string[][] = [
  ['2025-01-13', 'v1.9', 'KR', 'mobile', 'new', '1000', '200', '60'],
  ['2025-01-13', 'v1.9', 'KR', 'mobile', 'returning', '500', '100', '30'],
  ['2025-01-13', 'v1.9', 'KR', 'desktop', 'new', '400', '80', '24'],
  ['2025-01-13', 'v1.9', 'US', 'mobile', 'new', '600', '120', '36'],
  ['2025-01-13', 'v1.9', 'US', 'desktop', 'returning', '300', '60', '18'],
  ['2025-01-14', 'v1.9', 'KR', 'mobile', 'new', '800', '160', '48'],
  ['2025-01-14', 'v1.9', 'US', 'mobile', 'returning', '250', '50', '15'],
  ['2025-01-14', 'v1.9', 'US', 'desktop', 'new', '350', '70', '21'],
  ['2025-01-18', 'v2.0', 'KR', 'mobile', 'new', '1200', '300', '90'],
  ['2025-01-18', 'v2.0', 'KR', 'mobile', 'returning', '700', '175', '52'],
  ['2025-01-18', 'v2.0', 'KR', 'desktop', 'new', '450', '90', '27'],
  ['2025-01-18', 'v2.0', 'US', 'mobile', 'new', '900', '225', '67'],
  ['2025-01-18', 'v2.0', 'US', 'desktop', 'returning', '320', '64', '19'],
  ['2025-01-19', 'v2.0', 'KR', 'desktop', 'new', '150', '0', '0'],
  ['2025-01-19', 'v2.0', 'US', 'mobile', 'returning', '260', '65', '20'],
  ['2025-01-19', 'v2.0', 'US', 'desktop', 'new', '380', '95', '28'],
];

export function studioDemoData(sample: StudioDemoSampleId): {
  id: StudioDemoSampleId;
  name: string;
  filename: string;
  description: string;
  csv: Buffer;
  rows: number;
  oracleSql: string;
  oracle: Record<string, string | number>;
  suggestedPrompt: string;
} {
  if (sample === 'margin') {
    const csv = toCsv(
      MARGIN_HEADER,
      MARGIN_ROWS.map(row => [
        row[0] + SNAPSHOT_TIME,
        row[1],
        row[2],
        row[3],
        row[4],
        row[5],
        row[6],
        row[7],
        'USD',
        row[8],
        row[9],
        money(cents(row[8]) - cents(row[9])),
      ]),
    );
    return {
      id: 'margin',
      name: '매출·비용·마진 데모(VM 합성)',
      filename: 'vm-synthetic-margin-demo.csv',
      description:
        'VM이 직접 만든 합성 매출·비용·이익 데이터입니다. 공식 Rill 샘플이나 실제 고객 데이터가 아닙니다. 금액은 USD이며 2025-01-06~2025-01-19 두 주, 고객사 6곳 18행으로 매출 0과 적자(이익 음수) 행을 포함합니다.',
      csv,
      rows: MARGIN_ROWS.length,
      // 저장 지표식 구현이 아니라 fixture 원시 열(profit = revenue - cost)을 합산하는 독립 확인 SQL이다.
      // CSV 자동 추론은 금액 열을 DOUBLE로 읽으므로 합계를 DECIMAL(18,2)로 캐스팅해 고정 문자열과 비교한다.
      oracleSql:
        'SELECT COUNT(*) AS n, SUM(revenue)::DECIMAL(18,2) AS revenue, SUM(cost)::DECIMAL(18,2) AS cost, SUM(profit)::DECIMAL(18,2) AS profit FROM uploaded_data',
      oracle: { n: 18, revenue: '14937.49', cost: '12279.94', profit: '2657.55' },
      suggestedPrompt: '고객사별 매출·비용·이익과 마진율을 요약하고, 적자 고객을 찾아 줘.',
    };
  }
  if (['margin-reuse', 'margin-missing', 'margin-krw'].includes(sample)) {
    // Different source values AND names: unchanged ratios would conceal an incorrect remap.
    // KRW is an independent synthetic amount fixture, never a USD currency conversion.
    const krw = sample === 'margin-krw';
    const missing = sample === 'margin-missing';
    const header = [
      'day',
      'company',
      'currency',
      'sales_amount',
      'expense_amount',
      ...(!missing ? ['net_profit'] : []),
    ];
    const rows = MARGIN_ROWS.map(row => [
      row[0] + SNAPSHOT_TIME,
      row[1],
      krw ? 'KRW' : 'USD',
      money(cents(row[8]) * 2),
      money(cents(row[9]) * 3),
      ...(!missing ? [money(cents(row[8]) * 2 - cents(row[9]) * 3)] : []),
    ]);
    return {
      id: sample,
      name: missing
        ? 'VM 복제 연습 · 필수 이익 열 누락'
        : krw
        ? 'VM 복제 연습 · KRW 단위 오류'
        : 'VM 복제 연습 · 새 USD 파일',
      filename: 'vm-synthetic-' + sample + '-demo.csv',
      description:
        'VM 합성 복제 연습용 파일입니다. Rill 공식 자료가 아닙니다. 매출은 원본의 2배, 비용은 3배인 독립 금액이며 통화 환산이 아닙니다. ' +
        (missing
          ? '이익 열 누락 오류를 재현합니다.'
          : krw
          ? 'KRW이므로 USD 보고서에 연결할 수 없습니다.'
          : 'USD, 이름이 다른 금액 열을 직접 연결합니다.'),
      csv: toCsv(header, rows),
      rows: 18,
      oracleSql:
        'SELECT COUNT(*) AS n, SUM(sales_amount)::DECIMAL(18,2) AS revenue, SUM(expense_amount)::DECIMAL(18,2) AS cost' +
        (!missing ? ', SUM(net_profit)::DECIMAL(18,2) AS profit' : '') +
        ' FROM uploaded_data',
      oracle: {
        n: 18,
        revenue: '29874.98',
        cost: '36839.82',
        ...(!missing ? { profit: '-6964.84' } : {}),
      },
      suggestedPrompt: '새 파일의 매출·비용·이익과 비용률을 확인해 줘.',
    };
  }
  if (sample === 'funnel') {
    return {
      id: 'funnel',
      name: '앱 전환 퍼널 데모(VM 합성)',
      filename: 'vm-synthetic-funnel-demo.csv',
      description:
        'VM이 직접 만든 합성 앱 전환 집계 데이터입니다. 공식 Rill 샘플이나 실제 고객 데이터가 아닙니다. v1.9/v2.0·국가·기기·신규/기존을 포함한 일부 조합 16행이며 전환이 0인 행을 포함합니다.',
      csv: toCsv(
        FUNNEL_HEADER,
        FUNNEL_ROWS.map(row => [row[0] + SNAPSHOT_TIME, ...row.slice(1)]),
      ),
      rows: FUNNEL_ROWS.length,
      oracleSql:
        'SELECT COUNT(*) AS n, SUM(visits) AS visits, SUM(downloads) AS downloads, SUM(signups) AS signups FROM uploaded_data',
      oracle: { n: 16, visits: 8560, downloads: 1854, signups: 555 },
      suggestedPrompt: '앱 버전별로 방문→다운로드→가입 전환율을 비교해 줘.',
    };
  }
  throw new Error('unknown studio demo sample: ' + String(sample));
}
