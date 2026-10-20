import { DuckDBService } from '../analysis/duckdb.service';
import { StudioDemoSampleId, studioDemoData } from './studio-demo-data';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.setTimeout(120000);

const HEADERS: Record<'margin' | 'funnel', string[]> = {
  margin: [
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
  ],
  funnel: [
    'date',
    'version',
    'country',
    'device',
    'new_existing',
    'visits',
    'downloads',
    'signups',
  ],
};

describe('VM synthetic studio demo fixtures', () => {
  it.each([
    ['margin', 18],
    ['funnel', 16],
  ] as Array<[StudioDemoSampleId, number]>)(
    'keeps the %s fixture deterministic with %i data rows',
    (id, rowCount) => {
      const first = studioDemoData(id);
      const second = studioDemoData(id);
      expect(first.id).toBe(id);
      expect(first.rows).toBe(rowCount);
      // RXS-01/RXS-05 need a small deterministic fixture, not a production extract.
      expect(rowCount).toBeGreaterThanOrEqual(12);
      expect(rowCount).toBeLessThanOrEqual(30);
      expect(first.csv.equals(second.csv)).toBe(true);
      expect(first.filename).toMatch(/^vm-synthetic-[a-z]+-demo\.csv$/);
      expect(first.filename).toContain(id);
      const lines = first.csv.toString('utf8').trimEnd().split('\n');
      expect(lines).toHaveLength(rowCount + 1);
      expect(lines[0]).toBe(HEADERS[id].join(','));
      expect(first.name).toMatch(/[\uac00-\ud7a3]/);
      expect(first.name).toContain('VM');
      expect(first.description).toMatch(/[\uac00-\ud7a3]/);
      expect(first.description).toContain('합성');
      expect(first.description).toContain('Rill');
      expect(first.oracleSql).toMatch(/^SELECT\b/);
      expect(first.oracleSql).toContain('uploaded_data');
      expect(first.oracle.n).toBe(rowCount);
      expect(first.suggestedPrompt).toMatch(/[\uac00-\ud7a3]/);
      expect(studioDemoData('margin').filename).not.toBe(studioDemoData('funnel').filename);
    },
  );

  it('escapes company values that contain commas and double quotes', () => {
    const text = studioDemoData('margin').csv.toString('utf8');
    expect(text).toContain('"Samil Trading, Inc."');
    expect(text).toContain('"Danbi ""Prime"" Labs"');
    // Unquoted values stay unquoted.
    expect(text).toContain(',Hanul Foods,Enterprise,');
    // A naive comma split would break the escaped line into more fields than the header.
    const rows = text.trimEnd().split('\n');
    const samil = rows.find(row => row.includes('Samil Trading'));
    expect(samil).toBeDefined();
    expect(samil.split(',')).not.toHaveLength(HEADERS.margin.length);
  });
});

describe('versioned Rill comparison input', () => {
  it.each(['margin', 'funnel'] as const)('ships the exact VM %s sample bytes', sample => {
    const filename = path.resolve(
      __dirname,
      '../../../samples/rill-scenarios/data',
      sample + '.csv',
    );
    expect(fs.readFileSync(filename)).toEqual(studioDemoData(sample).csv);
  });
});

describe('studio demo fixtures through the real DuckDB worker', () => {
  let worker: DuckDBService;
  let root: string;
  const previousRoot = process.env.FILE_UPLOAD_DIR;

  const importSample = async (id: StudioDemoSampleId) => {
    const sample = studioDemoData(id);
    const imported = await worker.importFile({
      originalname: sample.filename,
      buffer: sample.csv,
    });
    return { sample, imported };
  };

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-demo-data-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
  });

  afterAll(async () => {
    await worker?.onModuleDestroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });

  it('matches the hardcoded margin totals and the per-row profit column', async () => {
    const { sample, imported } = await importSample('margin');
    expect(imported.rows).toBe(18);
    const rows = (await worker.query(imported.filename, sample.oracleSql)).datas;
    expect(rows).toEqual([sample.oracle]);
    // These literals are written here on purpose: they are not derived from the CSV builder.
    expect(sample.oracle).toEqual({
      n: 18,
      revenue: '14937.49',
      cost: '12279.94',
      profit: '2657.55',
    });
    for (const key of ['revenue', 'cost', 'profit']) {
      expect(Number.isFinite(Number(rows[0][key]))).toBe(true);
    }
    // CSV auto-detection reads the money columns as DOUBLE, so the fixture promises exact
    // two-decimal values rather than bit-exact float subtraction.
    expect(
      (
        await worker.query(
          imported.filename,
          'SELECT COUNT(*) AS n FROM uploaded_data WHERE ABS(profit - (revenue - cost)) > 1e-9',
        )
      ).datas,
    ).toEqual([{ n: 0 }]);
    expect(
      (
        await worker.query(
          imported.filename,
          'SELECT COUNT(*) AS n FROM uploaded_data WHERE revenue IS NULL OR cost IS NULL OR profit IS NULL OR revenue <> revenue OR cost <> cost OR profit <> profit',
        )
      ).datas,
    ).toEqual([{ n: 0 }]);
    // The product UI labels these amounts as USD; fractional cents stay valid here.
    expect(
      (
        await worker.query(
          imported.filename,
          "SELECT COUNT(*) AS n FROM uploaded_data WHERE currency = 'USD'",
        )
      ).datas,
    ).toEqual([{ n: 18 }]);
    const margin = (
      await worker.query(
        imported.filename,
        'SELECT SUM(profit) / SUM(revenue) AS margin FROM uploaded_data',
      )
    ).datas;
    expect(Number(margin[0].margin)).toBeCloseTo(0.17791141617500664, 9);
  });

  it('keeps zero-revenue, negative-profit and previous/current range rows', async () => {
    const { imported } = await importSample('margin');
    const count = async (sql: string) =>
      (await worker.query(imported.filename, sql)).datas[0].n as number;
    expect(await count('SELECT COUNT(*) AS n FROM uploaded_data WHERE revenue = 0')).toBe(2);
    expect(await count('SELECT COUNT(*) AS n FROM uploaded_data WHERE profit < 0')).toBe(4);
    expect(
      await count("SELECT COUNT(*) AS n FROM uploaded_data WHERE day < TIMESTAMP '2025-01-13'"),
    ).toBe(8);
    expect(
      await count("SELECT COUNT(*) AS n FROM uploaded_data WHERE day >= TIMESTAMP '2025-01-13'"),
    ).toBe(10);
  });

  it('reads an ISO timestamp day column and numeric money columns', async () => {
    const { imported } = await importSample('margin');
    const described = (await worker.query(imported.filename, 'DESCRIBE uploaded_data')).datas;
    expect(described.map((column: any) => column.column_name)).toEqual(HEADERS.margin);
    const types = new Map(
      described.map((column: any) => [column.column_name, String(column.column_type)]),
    );
    expect(types.get('day')).toBe('TIMESTAMP');
    // The money columns must stay numeric so the VM can aggregate and divide them.
    expect(types.get('revenue')).toMatch(/^(DOUBLE|DECIMAL)/);
    expect(types.get('profit')).toMatch(/^(DOUBLE|DECIMAL)/);
    const firstDay = (
      await worker.query(
        imported.filename,
        'SELECT CAST(MIN(day) AS VARCHAR) AS first_day FROM uploaded_data',
      )
    ).datas;
    expect(String(firstDay[0].first_day)).toContain('2025-01-06');
  });

  it('round-trips escaped company names through DuckDB', async () => {
    const { imported } = await importSample('margin');
    const companies = (
      await worker.query(
        imported.filename,
        'SELECT DISTINCT company FROM uploaded_data ORDER BY company',
      )
    ).datas.map((row: any) => row.company);
    expect(companies).toEqual([
      'Baro Tech',
      'Cheonji Retail',
      'Danbi "Prime" Labs',
      'Danbi Labs',
      'Hanul Foods',
      'Samil Trading, Inc.',
    ]);
  });

  it.each(['margin-reuse', 'margin-missing', 'margin-krw'] as const)(
    'imports distinct %s remap fixture with independent totals',
    async id => {
      const { sample, imported } = await importSample(id);
      expect((await worker.query(imported.filename, sample.oracleSql)).datas).toEqual([
        {
          n: 18,
          revenue: '29874.98',
          cost: '36839.82',
          ...(id !== 'margin-missing' ? { profit: '-6964.84' } : {}),
        },
      ]);
      const columns = (await worker.query(imported.filename, 'DESCRIBE uploaded_data')).datas.map(
        c => c.column_name,
      );
      expect(columns.includes('net_profit')).toBe(id !== 'margin-missing');
      const currency = (
        await worker.query(imported.filename, 'SELECT DISTINCT currency FROM uploaded_data')
      ).datas;
      expect(currency).toEqual([{ currency: id === 'margin-krw' ? 'KRW' : 'USD' }]);
      expect(sample.csv.equals(studioDemoData('margin').csv)).toBe(false);
    },
  );

  it('matches the hardcoded funnel totals and known conversion ratios', async () => {
    const { sample, imported } = await importSample('funnel');
    expect(imported.rows).toBe(16);
    const rows = (await worker.query(imported.filename, sample.oracleSql)).datas;
    expect(rows).toEqual([sample.oracle]);
    expect(sample.oracle).toEqual({ n: 16, visits: 8560, downloads: 1854, signups: 555 });
    const rates = (
      await worker.query(
        imported.filename,
        'SELECT SUM(downloads) / SUM(visits) AS download_rate, SUM(signups) / SUM(downloads) AS signup_rate FROM uploaded_data',
      )
    ).datas;
    expect(Number(rates[0].download_rate)).toBeCloseTo(0.21658878504672896, 9);
    expect(Number(rates[0].signup_rate)).toBeCloseTo(0.2993527508090615, 9);
    expect(
      (
        await worker.query(
          imported.filename,
          'SELECT COUNT(*) AS n FROM uploaded_data WHERE downloads = 0 AND signups = 0',
        )
      ).datas,
    ).toEqual([{ n: 1 }]);
    const described = (await worker.query(imported.filename, 'DESCRIBE uploaded_data')).datas;
    expect(described.map((column: any) => column.column_name)).toEqual(HEADERS.funnel);
    const dimensions = (
      await worker.query(
        imported.filename,
        'SELECT COUNT(DISTINCT version) AS versions, COUNT(DISTINCT country) AS countries, COUNT(DISTINCT device) AS devices, COUNT(DISTINCT new_existing) AS cohorts FROM uploaded_data',
      )
    ).datas;
    expect(dimensions).toEqual([{ versions: 2, countries: 2, devices: 2, cohorts: 2 }]);
  });
});
