import { AiService } from './ai.service';
import { ResponseStatus } from '../common/enum/response-status.enum';

describe('AiService', () => {
  const mockKnex: any = Object.assign(
    jest.fn(() => ({
      columnInfo: jest.fn().mockResolvedValue({
        id: { type: 'int' },
        name: { type: 'varchar' },
      }),
    })),
    { client: { config: { client: 'mysql2' } } },
  );

  const connectionService = {
    getKnex: jest.fn().mockResolvedValue(mockKnex),
  } as any;

  const databaseService = {
    findOne: jest.fn().mockResolvedValue({
      status: ResponseStatus.SUCCESS,
      data: { tables: [{ tableName: 'users' }, { tableName: 'orders' }] },
    }),
    findData: jest.fn().mockResolvedValue({
      status: ResponseStatus.SUCCESS,
      data: {
        datas: [{ date: '2024-01-01', sales: 100 }],
        fields: [
          { columnName: 'date', columnType: 'string' },
          { columnName: 'sales', columnType: 'number' },
        ],
      },
    }),
  } as any;

  const componentRepository = {
    find: jest.fn().mockResolvedValue([
      { id: 1, type: 'LINE_CHART', title: '선형 차트', useYn: 'Y' },
      { id: 2, type: 'BAR_CHART', title: '막대 차트', useYn: 'Y' },
    ]),
  } as any;

  const dashboardRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 1, title: '매출 대시보드' }),
  } as any;

  const dashboardWidgetService = {
    findWidgets: jest.fn().mockResolvedValue([
      {
        id: 1,
        title: '매출 차트',
        componentType: 'LINE_CHART',
        datasetType: 'DATASET',
        datasetId: 10,
      },
    ]),
  } as any;

  let service: AiService;
  const envBackup = { ...process.env };

  beforeEach(() => {
    service = new AiService(
      connectionService,
      databaseService,
      componentRepository,
      dashboardRepository,
      dashboardWidgetService,
    );
    jest.clearAllMocks();
    delete process.env.AI_API_KEY;
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('databaseId가 유효하지 않으면 ERROR를 반환한다', async () => {
    const res = await service.textToSql(0, 'select all users');
    expect(res.status).toBe(ResponseStatus.ERROR);
  });

  it('prompt가 비어있으면 ERROR를 반환한다', async () => {
    const res = await service.textToSql(1, '   ');
    expect(res.status).toBe(ResponseStatus.ERROR);
  });

  it('AI_API_KEY가 없으면 미설정 에러를 반환한다', async () => {
    const res = await service.textToSql(1, 'select all users');
    expect(res.status).toBe(ResponseStatus.ERROR);
    expect(res.message).toContain('AI_API_KEY');
  });

  it('LLM 응답에서 markdown fence를 제거하고 SQL을 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```sql\nSELECT * FROM users LIMIT 10;\n```' } }],
      }),
    }) as any;

    const res = await service.textToSql(1, '사용자 10명 조회');
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.sql).toBe('SELECT * FROM users LIMIT 10');
  });

  it('생성된 쿼리가 쓰기 쿼리면 read-only 가드가 차단한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'DROP TABLE users' } }],
      }),
    }) as any;

    const res = await service.textToSql(1, 'delete everything');
    expect(res.status).toBe(ResponseStatus.ERROR);
    expect(res.message).toContain('안전하지 않습니다');
  });

  it('LLM API가 에러를 반환하면 ERROR를 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    }) as any;

    const res = await service.textToSql(1, 'select users');
    expect(res.status).toBe(ResponseStatus.ERROR);
  });

  it('recommendChart는 등록된 component의 type만 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"type":"LINE_CHART","reason":"시계열 데이터"}' } }],
      }),
    }) as any;

    const res = await service.recommendChart({
      databaseId: 1,
      datasetType: 'TABLE' as any,
      tableName: 'sales',
    });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.component.type).toBe('LINE_CHART');
    expect(res.data.reason).toBe('시계열 데이터');
  });

  it('recommendChart는 목록에 없는 type을 반환하면 ERROR를 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"type":"HACK","reason":"x"}' } }],
      }),
    }) as any;

    const res = await service.recommendChart({
      databaseId: 1,
      datasetType: 'TABLE' as any,
      tableName: 'sales',
    });
    expect(res.status).toBe(ResponseStatus.ERROR);
  });

  it('dashboardInsight는 위젯 데이터 컨텍스트로 인사이트를 생성한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '- 1월 매출이 100으로 증가\n총평: 양호' } }],
      }),
    }) as any;

    const res = await service.dashboardInsight(1);
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.insight).toContain('매출');
  });

  it('dashboardInsight는 대시보드가 없으면 ERROR를 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    dashboardRepository.findOne.mockResolvedValueOnce(null);
    const res = await service.dashboardInsight(999);
    expect(res.status).toBe(ResponseStatus.ERROR);
  });
});
