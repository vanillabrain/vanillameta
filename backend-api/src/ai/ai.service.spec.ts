import { HttpException } from '@nestjs/common';
import { AiService } from './ai.service';
import { ResponseStatus } from '../common/enum/response-status.enum';

// The gateway (which loads the ESM-only AI SDK) has its own spec; here it is a double that records how
// AiService uses it.
jest.mock('./llm-gateway.service', () => ({ LlmGateway: class {} }));
jest.mock('./coding-agent', () => ({ CODEX_MODEL: 'gpt-6-luna', callCodingAgent: jest.fn() }));

const caller = { userId: 1, epoch: 0, feature: 'test' };
const gateway = { generate: jest.fn(), assertCallsAvailable: jest.fn() };

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

  const userMappingRepository = {
    findOne: jest.fn().mockResolvedValue({ dashboardId: 1, userInfoId: 7 }),
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
      userMappingRepository,
      gateway as any,
    );
    jest.clearAllMocks();
    delete process.env.AI_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('hands a model call to the gateway with the caller, the JSON mode and the abort signal', async () => {
    const controller = new AbortController();
    gateway.generate.mockResolvedValueOnce('{"ok":true}');
    expect(await service.callLlm('schema', 'question', true, controller.signal, caller)).toBe(
      '{"ok":true}',
    );
    expect(gateway.generate).toHaveBeenCalledWith({
      system: 'schema',
      prompt: 'question',
      jsonMode: true,
      abortSignal: controller.signal,
      caller,
    });
    gateway.generate.mockRejectedValueOnce(new Error('LLM_CODEX_UNAVAILABLE'));
    await expect(service.callLlm('schema', 'question', false, undefined, caller)).rejects.toThrow(
      'LLM_CODEX_UNAVAILABLE',
    );
  });

  it('asks the gateway whether the day still has room for a multi-call action', async () => {
    gateway.assertCallsAvailable.mockResolvedValueOnce(undefined);
    await service.assertCallsAvailable(caller, 3);
    expect(gateway.assertCallsAvailable).toHaveBeenCalledWith(caller, 3);
  });

  it('allows all three endpoints with Codex configuration and truthful metadata', async () => {
    process.env.AI_PROVIDER = 'codex';
    gateway.generate
      .mockResolvedValueOnce('SELECT * FROM users LIMIT 10')
      .mockResolvedValueOnce('{"type":"LINE_CHART","reason":"시계열"}')
      .mockResolvedValueOnce('- 매출 100');
    const results = [
      await service.textToSql(1, '사용자 조회', { userId: 1, epoch: 0, feature: 'test' }),
      await service.recommendChart(
        {
          databaseId: 1,
          datasetType: 'TABLE' as any,
          tableName: 'sales',
        },
        { userId: 1, epoch: 0, feature: 'test' },
      ),
      await service.dashboardInsight(1, 7, 0),
    ];
    for (const result of results) {
      expect(result.status).toBe(ResponseStatus.SUCCESS);
      expect(result.data.ai).toEqual({ provider: 'codex', requestedModel: 'gpt-6-luna' });
    }
  });

  it('reports Codex failure as generation failure rather than unsafe SQL', async () => {
    process.env.AI_PROVIDER = 'codex';
    gateway.generate.mockRejectedValueOnce(new Error('LLM_CODEX_TIMEOUT'));
    const result = await service.textToSql(1, '사용자 조회', {
      userId: 1,
      epoch: 0,
      feature: 'test',
    });
    expect(result.status).toBe(ResponseStatus.ERROR);
    expect(result.message).toBe('AI 쿼리 생성 중 오류가 발생했습니다.');
  });

  it('lets the gateway’s quota refusal through all three endpoints instead of a generic error', async () => {
    process.env.AI_API_KEY = 'test-key';
    const refusal = new HttpException({ error: 'AI_QUOTA_EXCEEDED', message: 'limit' }, 429);
    gateway.generate.mockRejectedValue(refusal);
    await expect(service.textToSql(1, '사용자 조회', caller)).rejects.toBe(refusal);
    await expect(
      service.recommendChart(
        { databaseId: 1, datasetType: 'TABLE' as any, tableName: 'sales' },
        caller,
      ),
    ).rejects.toBe(refusal);
    await expect(service.dashboardInsight(1, 7, 0)).rejects.toBe(refusal);
  });

  it('tells screens which provider and model is really configured, without throwing on a bad setting', async () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'gpt-x';
    expect((service as any).providerMetadata()).toEqual({
      provider: 'api',
      requestedModel: 'gpt-x',
    });
    process.env.AI_PROVIDER = 'nonsense';
    expect((service as any).providerMetadata()).toEqual({ provider: 'api', requestedModel: '' });
  });

  it('uses the DuckDB schema and dialect without invoking Knex', async () => {
    connectionService.isDuckDB = jest.fn().mockResolvedValue(true);
    connectionService.queryDuckDB = jest
      .fn()
      .mockResolvedValue({ datas: [{ column_name: 'requests', column_type: 'BIGINT' }] });
    try {
      expect(await (service as any).getSchemaContext(3)).toEqual({
        dialect: 'DuckDB',
        schemaText: '- uploaded_data(requests BIGINT)',
      });
      expect(connectionService.getKnex).not.toHaveBeenCalled();
    } finally {
      delete connectionService.isDuckDB;
      delete connectionService.queryDuckDB;
    }
  });

  it('databaseId가 유효하지 않으면 ERROR를 반환한다', async () => {
    const res = await service.textToSql(0, 'select all users', {
      userId: 1,
      epoch: 0,
      feature: 'test',
    });
    expect(res.status).toBe(ResponseStatus.ERROR);
  });

  it('prompt가 비어있으면 ERROR를 반환한다', async () => {
    const res = await service.textToSql(1, '   ', { userId: 1, epoch: 0, feature: 'test' });
    expect(res.status).toBe(ResponseStatus.ERROR);
  });

  it('AI_API_KEY가 없으면 미설정 에러를 반환한다', async () => {
    const res = await service.textToSql(1, 'select all users', {
      userId: 1,
      epoch: 0,
      feature: 'test',
    });
    expect(res.status).toBe(ResponseStatus.ERROR);
    // End users are told whom to ask, not which environment variable the operator forgot.
    expect(res.message).toContain('운영자에게 문의');
    expect(res.message).not.toContain('AI_API_KEY');
  });

  it('LLM 응답에서 markdown fence를 제거하고 SQL을 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    gateway.generate.mockResolvedValueOnce('```sql\nSELECT * FROM users LIMIT 10;\n```');

    const res = await service.textToSql(1, '사용자 10명 조회', {
      userId: 1,
      epoch: 0,
      feature: 'test',
    });
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.sql).toBe('SELECT * FROM users LIMIT 10');
    expect(gateway.generate).toHaveBeenCalledWith(
      expect.objectContaining({ caller, jsonMode: false }),
    );
    expect(res.data.ai).toEqual({ provider: 'api', requestedModel: 'gpt-4o-mini' });
    expect(gateway.generate).toHaveBeenCalledTimes(1);
  });

  it('생성된 쿼리가 쓰기 쿼리면 read-only 가드가 차단한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    gateway.generate.mockResolvedValueOnce('DROP TABLE users');

    const res = await service.textToSql(1, 'delete everything', {
      userId: 1,
      epoch: 0,
      feature: 'test',
    });
    expect(res.status).toBe(ResponseStatus.ERROR);
    // This wording carries the read-only guard's own fixed message and nothing else.
    expect(res.message).toBe('생성된 쿼리가 안전하지 않습니다: only read-only queries are allowed');
  });

  it('LLM API가 에러를 반환하면 ERROR를 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    gateway.generate.mockRejectedValueOnce(new Error('LLM_API_ERROR_500'));

    const res = await service.textToSql(1, 'select users', {
      userId: 1,
      epoch: 0,
      feature: 'test',
    });
    expect(res.status).toBe(ResponseStatus.ERROR);
  });

  it('logs which gateway failure it was and nothing of the model’s answer, and tells the user only a fixed sentence', async () => {
    process.env.AI_API_KEY = 'test-key';
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      gateway.generate.mockRejectedValueOnce(new Error('LLM_API_ERROR_401'));
      const failed = await service.textToSql(1, 'select users', caller);
      expect(failed.message).toBe('AI 쿼리 생성 중 오류가 발생했습니다.');
      expect(logged).toHaveBeenLastCalledWith('AI call failed: LLM_API_ERROR_401');
      // An internal error (a ledger outage, a bad caller) is not echoed to the user either.
      gateway.generate.mockRejectedValueOnce(new Error('ER_LOCK_DEADLOCK at ai_usage_ledger'));
      const internal = await service.textToSql(1, 'select users', caller);
      expect(internal.message).toBe('AI 쿼리 생성 중 오류가 발생했습니다.');
      expect(internal.message).not.toContain('ER_LOCK');
      expect(logged).toHaveBeenLastCalledWith('AI call failed: Error');
      // A model answer that is not JSON: the SyntaxError message quotes it, the log must not.
      gateway.generate.mockResolvedValueOnce('Here is the chart you asked for: BAR');
      const chart = await service.recommendChart(
        { databaseId: 1, datasetType: 'TABLE' as any, tableName: 'sales' },
        caller,
      );
      expect(chart.status).toBe(ResponseStatus.ERROR);
      expect(logged).toHaveBeenLastCalledWith('AI call failed: SyntaxError');
      expect(JSON.stringify(logged.mock.calls)).not.toContain('Here is');
    } finally {
      logged.mockRestore();
    }
  });

  it('recommendChart는 등록된 component의 type만 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    gateway.generate.mockResolvedValueOnce('{"type":"LINE_CHART","reason":"시계열 데이터"}');

    const res = await service.recommendChart(
      {
        databaseId: 1,
        datasetType: 'TABLE' as any,
        tableName: 'sales',
      },
      { userId: 1, epoch: 0, feature: 'test' },
    );
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.component.type).toBe('LINE_CHART');
    expect(res.data.reason).toBe('시계열 데이터');
  });

  it('recommendChart는 목록에 없는 type을 반환하면 ERROR를 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    gateway.generate.mockResolvedValueOnce('{"type":"HACK","reason":"x"}');

    const res = await service.recommendChart(
      {
        databaseId: 1,
        datasetType: 'TABLE' as any,
        tableName: 'sales',
      },
      { userId: 1, epoch: 0, feature: 'test' },
    );
    expect(res.status).toBe(ResponseStatus.ERROR);
  });

  it('dashboardInsight는 위젯 데이터 컨텍스트로 인사이트를 생성한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    gateway.generate.mockResolvedValueOnce('- 1월 매출이 100으로 증가\n총평: 양호');

    const res = await service.dashboardInsight(1, 7, 0);
    expect(res.status).toBe(ResponseStatus.SUCCESS);
    expect(res.data.insight).toContain('매출');
  });

  it('dashboardInsight는 대시보드가 없으면 ERROR를 반환한다', async () => {
    process.env.AI_API_KEY = 'test-key';
    dashboardRepository.findOne.mockResolvedValueOnce(null);
    userMappingRepository.findOne.mockResolvedValueOnce({ dashboardId: 999, userInfoId: 7 });
    const res = await service.dashboardInsight(999, 7, 0);
    expect(res.status).toBe(ResponseStatus.ERROR);
  });

  it('dashboardInsight rejects non-owners before widget data or LLM access', async () => {
    process.env.AI_API_KEY = 'test-key';
    userMappingRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.dashboardInsight(1, 8, 0)).rejects.toMatchObject({ status: 403 });
    expect(userMappingRepository.findOne).toHaveBeenCalledWith({
      where: { dashboardId: 1, userInfoId: 8 },
    });
    expect(dashboardWidgetService.findWidgets).not.toHaveBeenCalled();
    expect(databaseService.findData).not.toHaveBeenCalled();
  });

  it('dashboardInsight does not allow a missing requester', async () => {
    await expect(service.dashboardInsight(1, undefined, 0)).rejects.toMatchObject({ status: 403 });
    expect(userMappingRepository.findOne).not.toHaveBeenCalled();
    expect(dashboardWidgetService.findWidgets).not.toHaveBeenCalled();
  });
});
