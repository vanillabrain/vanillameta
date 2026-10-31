import { MicrosoftDocsProvider } from './microsoft-docs.provider';
import { GoogleSheetsProvider, toCsv } from './google-sheets.provider';
import { summarizeDocument, SummaryConsentRequired } from './document-summary';

const env = { ...process.env };
const setEnv = (values: Record<string, string | undefined>) => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
afterEach(() => {
  process.env = { ...env };
});
describe('Microsoft document connection contract', () => {
  it('fails closed without a callback configuration', () => {
    setEnv({
      MS_DOCS_CLIENT_ID: undefined,
      MS_DOCS_CLIENT_SECRET: undefined,
      MS_DOCS_REDIRECT_URI: undefined,
    });
    const provider = new MicrosoftDocsProvider();
    expect(provider.configured()).toBe(false);
    expect(() => provider.authorizationUrl({ state: 's', verifier: 'v', itemId: 'i' })).toThrow();
  });
  it('builds a PKCE authorization URL and exchanges the code', async () => {
    setEnv({
      MS_DOCS_CLIENT_ID: 'client',
      MS_DOCS_CLIENT_SECRET: 'secret',
      MS_DOCS_REDIRECT_URI: 'http://localhost:4000/v1/documents/microsoft/callback',
      NODE_ENV: 'dev',
    });
    const provider = new MicrosoftDocsProvider();
    const url = new URL(
      provider.authorizationUrl({ state: 'state-1', verifier: 'verifier-1', itemId: 'item' }),
    );
    expect(url.host).toBe('login.microsoftonline.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('verifier-1');
    expect(url.searchParams.get('scope')).toContain('Files.Read.All');
    let seen: URLSearchParams | null = null;
    const fetchMock = (async (_url: string, init: RequestInit) => {
      seen = init.body as URLSearchParams;
      return json({ access_token: 'access', refresh_token: 'refresh' });
    }) as unknown as typeof fetch;
    const tokens = await provider.exchange('code-1', 'verifier-1', fetchMock);
    expect(tokens).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    expect(seen?.get('code_verifier')).toBe('verifier-1');
    expect(seen?.get('grant_type')).toBe('authorization_code');
  });
  it('rejects Word documents and reads text items', async () => {
    setEnv({
      MS_DOCS_CLIENT_ID: 'client',
      MS_DOCS_CLIENT_SECRET: 'secret',
      MS_DOCS_REDIRECT_URI: 'https://app.example.com/documents/microsoft/callback',
    });
    const provider = new MicrosoftDocsProvider();
    const word = (async () =>
      json({
        id: 'i',
        name: 'doc.docx',
        file: {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      })) as unknown as typeof fetch;
    await expect(provider.item('token', 'i', word)).rejects.toThrow('텍스트 문서만');
    const text = (async () =>
      json({
        id: 'i',
        name: 'doc.txt',
        file: { mimeType: 'text/plain' },
        lastModifiedDateTime: '2026-10-31T00:00:00Z',
      })) as unknown as typeof fetch;
    expect(await provider.item('token', 'i', text)).toEqual({
      id: 'i',
      name: 'doc.txt',
      mimeType: 'text/plain',
      lastModifiedAt: '2026-10-31T00:00:00Z',
    });
  });
});
describe('Google Sheets data source contract', () => {
  it('requests unformatted values and converts them to CSV', async () => {
    setEnv({
      GOOGLE_SHEETS_CLIENT_ID: 'client',
      GOOGLE_SHEETS_CLIENT_SECRET: 'secret',
      GOOGLE_SHEETS_REDIRECT_URI: 'https://app.example.com/documents/sheets/callback',
    });
    const provider = new GoogleSheetsProvider();
    const url = new URL(provider.authorizationUrl({ state: 's', verifier: 'v' }));
    expect(url.searchParams.get('scope')).toContain('spreadsheets.readonly');
    let seen = '';
    const fetchMock = (async (target: string) => {
      seen = target;
      return json({
        values: [
          ['channel', 'revenue'],
          ['a,b', 1200],
          ['line\nbreak', null],
        ],
      });
    }) as unknown as typeof fetch;
    const rows = await provider.values('token', 'sheet-1', 'A1:B3', fetchMock);
    expect(seen).toContain('UNFORMATTED_VALUE');
    expect(seen).toContain('spreadsheetId'.length ? 'sheet-1' : '');
    expect(toCsv(rows)).toBe('channel,revenue\n"a,b",1200\n"line\nbreak",');
  });
  it('refuses a range above the cell cap', async () => {
    setEnv({
      GOOGLE_SHEETS_CLIENT_ID: 'client',
      GOOGLE_SHEETS_CLIENT_SECRET: 'secret',
      GOOGLE_SHEETS_REDIRECT_URI: 'https://app.example.com/documents/sheets/callback',
    });
    const values = Array.from({ length: 1001 }, () => Array.from({ length: 100 }, () => 'x'));
    const fetchMock = (async () => json({ values })) as unknown as typeof fetch;
    await expect(new GoogleSheetsProvider().values('t', 's', 'A:CV', fetchMock)).rejects.toThrow(
      '100,000',
    );
  });
});
describe('Document summary cost consent', () => {
  it('does not call the model without explicit confirmation', async () => {
    const generate = jest.fn();
    await expect(
      summarizeDocument({ confirmAiCost: false, title: '보고서', markdown: '본문', generate }),
    ).rejects.toBeInstanceOf(SummaryConsentRequired);
    expect(generate).not.toHaveBeenCalled();
  });
  it('sends the confirmed request with the document text and trims the answer', async () => {
    const generate = jest.fn().mockResolvedValue('  요약 문장.  ');
    const result = await summarizeDocument({
      confirmAiCost: true,
      title: '매출 보고서',
      markdown: '매출 1200',
      generate,
    });
    expect(result.summary).toBe('요약 문장.');
    expect(generate.mock.calls[0][0]).toContain('매출 보고서');
    expect(generate.mock.calls[0][0]).toContain('5문장');
  });
});

describe('Sheets CSV source contract', () => {
  it('builds a header-first CSV and drops empty rows', async () => {
    const { buildSheetCsv } = await import('./sheets-source');
    const result = buildSheetCsv([
      ['channel', 'revenue'],
      ['a,b', '1200'],
      ['', ''],
    ]);
    expect(result.columns).toEqual(['channel', 'revenue']);
    expect(result.rowCount).toBe(1);
    expect(result.csv).toBe('channel,revenue\n"a,b",1200');
  });
  it('refuses empty, duplicate or oversized headers and cells', async () => {
    const { buildSheetCsv } = await import('./sheets-source');
    expect(() => buildSheetCsv([['only']])).toThrow('헤더와 데이터');
    expect(() =>
      buildSheetCsv([
        ['a', 'a'],
        ['1', '2'],
      ]),
    ).toThrow('중복');
    expect(() =>
      buildSheetCsv([
        ['a', ''],
        ['1', '2'],
      ]),
    ).toThrow('빈 열');
    expect(() =>
      buildSheetCsv([Array.from({ length: 51 }, (_, i) => 'c' + i), Array(51).fill('1')]),
    ).toThrow('50');
    expect(() => buildSheetCsv([['a'], ['x'.repeat(1001)]])).toThrow('1000');
  });
});

describe('Sheets upload handoff', () => {
  it('builds the upload object DatabaseService.uploadFile imports into DuckDB', async () => {
    const { sheetUploadFile } = await import('./sheets-source');
    const upload = sheetUploadFile('매출/2026:Q4', [['channel', 'revenue'], ['Site', '300']]);
    expect(upload.originalname).toBe('매출_2026_Q4.csv');
    expect(upload.buffer.toString('utf8')).toBe('channel,revenue\nSite,300');
    expect(upload.columns).toEqual(['channel', 'revenue']);
    expect(upload.rowCount).toBe(1);
    expect(Buffer.isBuffer(upload.buffer)).toBe(true);
  });
  it('keeps a usable name for empty or very long titles', async () => {
    const { sheetUploadFile } = await import('./sheets-source');
    expect(sheetUploadFile('   ', [['a'], ['1']]).originalname).toBe('sheet.csv');
    expect(sheetUploadFile('x'.repeat(200), [['a'], ['1']]).originalname).toBe('x'.repeat(80) + '.csv');
  });
});

