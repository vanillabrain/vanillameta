import { MetricService } from './metric.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { MetricAggregation } from './entities/metric.entity';

describe('MetricService', () => {
  const rawMock = jest.fn();
  const mockKnex: any = { raw: rawMock };

  const metricRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(d => d),
    save: jest.fn(d => Promise.resolve({ id: 1, ...d })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  } as any;

  const connectionService = {
    getKnex: jest.fn().mockResolvedValue(mockKnex),
  } as any;

  let service: MetricService;

  beforeEach(() => {
    service = new MetricService(metricRepository, connectionService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('recreation replaces optional grouping, description and filters from the deleted definition', async () => {
      metricRepository.findOne.mockResolvedValueOnce({
        id: 5,
        name: 'revived',
        useYn: 'N',
        groupBy: 'region',
        description: 'old description',
        filters: JSON.stringify([{ column: 'region', op: '=', value: '서울' }]),
      });
      const res = await service.create({
        name: 'revived',
        databaseId: 2,
        tableName: 'uploaded_data',
        aggregation: MetricAggregation.MAX,
        expression: 'amount',
      });
      expect(metricRepository.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          groupBy: null,
          description: null,
          filters: null,
        }),
      );
      expect(res.data).toEqual(
        expect.objectContaining({ groupBy: null, description: null, filters: [] }),
      );
    });
    it('정상적인 메트릭을 생성한다', async () => {
      const res = await service.create({
        name: 'total_sales',
        databaseId: 1,
        tableName: 'orders',
        aggregation: MetricAggregation.SUM,
        expression: 'amount',
      });
      expect(res.status).toBe(ResponseStatus.SUCCESS);
    });

    it('식별자가 안전하지 않으면 거부한다', async () => {
      const res = await service.create({
        name: 'evil',
        databaseId: 1,
        tableName: 'orders; DROP TABLE users',
        aggregation: MetricAggregation.SUM,
        expression: 'amount',
      });
      expect(res.status).toBe(ResponseStatus.ERROR);
    });

    it('지원하지 않는 집계함수를 거부한다', async () => {
      const res = await service.create({
        name: 'evil',
        databaseId: 1,
        tableName: 'orders',
        aggregation: 'EVIL' as any,
        expression: 'amount',
      });
      expect(res.status).toBe(ResponseStatus.ERROR);
    });

    it('같은 이름의 활성 메트릭이 있으면 거부한다', async () => {
      metricRepository.findOne.mockResolvedValueOnce({ id: 5, name: 'dup', useYn: 'Y' });
      const res = await service.create({
        name: 'dup',
        databaseId: 1,
        tableName: 'orders',
        aggregation: MetricAggregation.SUM,
        expression: 'amount',
      });
      expect(res.status).toBe(ResponseStatus.ERROR);
      expect(res.message).toContain('이미 존재');
    });

    it('soft-delete된 메트릭과 같은 이름이면 재활성화한다', async () => {
      metricRepository.findOne.mockResolvedValueOnce({ id: 5, name: 'revived', useYn: 'N' });
      const res = await service.create({
        name: 'revived',
        databaseId: 2,
        tableName: 'orders',
        aggregation: MetricAggregation.COUNT,
        expression: 'amount',
      });
      expect(res.status).toBe(ResponseStatus.SUCCESS);
      expect(res.data.id).toBe(5);
      expect(res.data.useYn).toBe('Y');
      expect(metricRepository.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ useYn: 'Y' }),
      );
    });
  });

  it('rejects empty IN values before create persistence', async () => {
    const res = await service.create({
      name: 'empty_in',
      databaseId: 1,
      tableName: 'orders',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      filters: [{ column: 'region', op: 'IN', value: [] }],
    });
    expect(res.status).toBe(ResponseStatus.ERROR);
    expect(metricRepository.save).not.toHaveBeenCalled();
    expect(metricRepository.update).not.toHaveBeenCalled();
  });

  it('rejects empty IN values before updating an active metric', async () => {
    metricRepository.findOne.mockResolvedValueOnce({
      id: 1,
      name: 'active',
      databaseId: 1,
      tableName: 'orders',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      filters: null,
      useYn: 'Y',
    });
    const res = await service.update(1, { filters: [{ column: 'region', op: 'IN', value: [] }] });
    expect(res.status).toBe(ResponseStatus.ERROR);
    expect(metricRepository.update).not.toHaveBeenCalled();
  });

  it('does not read, evaluate or update a deleted metric', async () => {
    metricRepository.findOne.mockResolvedValue({ id: 1, useYn: 'N' });
    expect((await service.findOne(1)).status).toBe(ResponseStatus.ERROR);
    expect((await service.evaluate(1)).status).toBe(ResponseStatus.ERROR);
    expect((await service.update(1, { name: 'should_not_restore' })).status).toBe(
      ResponseStatus.ERROR,
    );
    expect(connectionService.getKnex).not.toHaveBeenCalled();
    expect(metricRepository.update).not.toHaveBeenCalled();
  });

  describe('legacy API structured definition boundary', () => {
    const legacyDto = {
      name: 'bi_saved_metric',
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
    };
    const definition = JSON.stringify({
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 1,
      tableName: 'uploaded_data',
      label: 'Revenue',
      aggregation: 'SUM',
      column: 'amount',
    });

    it.each(['create', 'update'] as const)(
      'rejects forged definition JSON through legacy %s before persistence',
      async operation => {
        metricRepository.findOne.mockResolvedValue({
          ...legacyDto,
          id: 5,
          definition: null,
          useYn: 'Y',
        });
        // Extra JSON fields can reach the service at runtime despite DTO typing.
        const dto = { ...legacyDto, definition };
        const result =
          operation === 'create' ? await service.create(dto) : await service.update(5, dto);
        expect(result.status).toBe(ResponseStatus.ERROR);
        expect(metricRepository.save).not.toHaveBeenCalled();
        expect(metricRepository.update).not.toHaveBeenCalled();
      },
    );

    it('does not reactivate a soft-deleted structured metric through legacy create', async () => {
      const stored = { ...legacyDto, id: 5, definition, useYn: 'N' };
      metricRepository.findOne.mockResolvedValueOnce(stored);
      const result = await service.create({ ...legacyDto, expression: 'other_amount' });
      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(metricRepository.findOne).toHaveBeenCalledWith({ where: { name: legacyDto.name } });
      expect(metricRepository.save).not.toHaveBeenCalled();
      expect(metricRepository.update).not.toHaveBeenCalled();
      expect(stored).toMatchObject({ definition, useYn: 'N', expression: 'amount' });
    });

    it('keeps an active structured metric immutable even when update supplies no definition', async () => {
      const stored = { ...legacyDto, id: 5, definition, useYn: 'Y' };
      metricRepository.findOne.mockResolvedValueOnce(stored);
      const result = await service.update(5, {
        databaseId: 2,
        aggregation: MetricAggregation.AVG,
        expression: 'other_amount',
      });
      expect(result.status).toBe(ResponseStatus.ERROR);
      expect(metricRepository.save).not.toHaveBeenCalled();
      expect(metricRepository.update).not.toHaveBeenCalled();
      expect(stored).toMatchObject({
        definition,
        databaseId: 1,
        aggregation: MetricAggregation.SUM,
        expression: 'amount',
      });
    });
  });

  describe('evaluate', () => {
    const baseMetric = {
      id: 1,
      name: 'total_sales',
      databaseId: 1,
      tableName: 'orders',
      aggregation: MetricAggregation.SUM,
      expression: 'amount',
      groupBy: null,
      filters: null,
    };

    it('단일 값 집계 SQL을 생성하고 실행한다', async () => {
      metricRepository.findOne.mockResolvedValue(baseMetric);
      rawMock.mockResolvedValue([[{ value: 1234 }]]);

      const res = await service.evaluate(1);
      expect(res.status).toBe(ResponseStatus.SUCCESS);
      const [sql, bindings] = rawMock.mock.calls[0];
      expect(sql).toBe('SELECT SUM(amount) AS value FROM orders');
      expect(bindings).toEqual([]);
    });

    it('groupBy가 있으면 GROUP BY와 LIMIT을 추가한다', async () => {
      metricRepository.findOne.mockResolvedValue({ ...baseMetric, groupBy: 'region' });
      rawMock.mockResolvedValue({ rows: [{ region: 'KR', value: 100 }] });

      const res = await service.evaluate(1);
      expect(res.status).toBe(ResponseStatus.SUCCESS);
      const [sql] = rawMock.mock.calls[0];
      expect(sql).toContain('GROUP BY region');
      expect(sql).toContain('LIMIT 500');
    });

    it('필터 값은 SQL에 인라인되지 않고 바인딩된다', async () => {
      metricRepository.findOne.mockResolvedValue({
        ...baseMetric,
        filters: JSON.stringify([{ column: 'status', op: '=', value: "x'; DROP TABLE users;--" }]),
      });
      rawMock.mockResolvedValue([[{ value: 0 }]]);

      await service.evaluate(1);
      const [sql, bindings] = rawMock.mock.calls[0];
      expect(sql).toContain('status = ?');
      expect(sql).not.toContain('DROP');
      expect(bindings).toEqual(["x'; DROP TABLE users;--"]);
    });

    it('IN 필터는 개수만큼 바인딩 플레이스홀더를 생성한다', async () => {
      metricRepository.findOne.mockResolvedValue({
        ...baseMetric,
        filters: JSON.stringify([{ column: 'region', op: 'IN', value: ['KR', 'US', 'JP'] }]),
      });
      rawMock.mockResolvedValue([[{ value: 0 }]]);

      await service.evaluate(1);
      const [sql, bindings] = rawMock.mock.calls[0];
      expect(sql).toContain('IN (?,?,?)');
      expect(bindings).toEqual(['KR', 'US', 'JP']);
    });

    it('메트릭이 없으면 ERROR를 반환한다', async () => {
      metricRepository.findOne.mockResolvedValue(null);
      const res = await service.evaluate(999);
      expect(res.status).toBe(ResponseStatus.ERROR);
    });
  });
});
