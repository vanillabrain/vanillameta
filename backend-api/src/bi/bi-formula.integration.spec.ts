jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import {
  businessSchemaRevision,
  businessProfile,
  captureBusinessBasis,
} from './semantic-business-basis';
import { DuckDBService } from '../analysis/duckdb.service';
import { ConnectionService } from '../connection/connection.service';
import { studioDemoData } from '../dashboard-studio/studio-demo-data';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiSegmentService } from './bi-segment.service';
import { BiService } from './bi.service';
import { metricExpression } from './metric-expression';
import { pinMetricFormula } from './metric-formula';
import { normalizeMetric, semanticCatalog } from './semantic-proposal';

jest.setTimeout(120000);

const selfRatioError = {
  status: 400,
  response: {
    code: 'FORMULA_SELF_RATIO',
    message:
      '분자와 분모가 같은 계산은 비율을 비교할 수 없습니다. 서로 다른 지표나 계산을 선택해 주세요.',
  },
};

/**
 * RXS-03 saved FORMULA boundary over the real DuckDB worker and a real SQLite metric repository.
 * The helper-level snapshot/unit rules live in metric-formula.spec.ts; this file only proves the
 * BiService boundary: preview/read-only, one persisted row with frozen operand snapshots, the same
 * canonical SQL for prepare, preview and the segment KPIs/groups, and fail-closed rejections.
 */
describe('saved FORMULA metrics over real DuckDB and the SQLite metric repository', () => {
  const actor = 10;
  const stranger = 99;
  const previousRoot = process.env.FILE_UPLOAD_DIR;
  /** (SUM(revenue) - SUM(cost)) / SUM(revenue) * 100 over the VM margin fixture. */
  const MARGIN_PERCENT = 17.7911416;
  let root: string;
  let worker: DuckDBService;
  let db: DataSource;
  let connection: ConnectionService;
  let bi: BiService;
  let segment: BiSegmentService;
  let profile: any;
  let sourceRevision: string;

  const reference = (metricId: number, definitionVersion = 1) => ({ metricId, definitionVersion });
  const marginRatio = () => ({
    op: 'ratio' as const,
    left: { op: 'subtract' as const, left: reference(1), right: reference(2) },
    right: reference(1),
    scale: 100 as const,
  });
  const formulaBody = (expression: any, extra: any = {}) => ({
    sourceId: 1,
    expectedSourceRevision: profile.dataVersion,
    label: '마진율',
    aggregation: 'FORMULA',
    expression,
    decimalPlaces: 2,
    numberNotation: 'plain',
    ...extra,
  });
  const storedDefinition = (label: string, column: string, sourceId = 1, extra: any = {}) => ({
    schemaVersion: 1,
    definitionVersion: 1,
    sourceId,
    tableName: 'uploaded_data',
    label,
    aggregation: 'SUM',
    column,
    unit: 'USD',
    decimalPlaces: 2,
    numberNotation: 'plain',
    ...extra,
  });
  const metrics = () => db.getRepository(Metric);
  const metricCount = () => metrics().count();
  const metricRow = (id: number) => metrics().findOneByOrFail({ id });
  const saveMetric = async (id: number, definition: any) => {
    const repo = metrics();
    return repo.save(
      repo.create({
        id,
        name: 'bi_fixture_' + id,
        databaseId: definition.sourceId,
        tableName: 'uploaded_data',
        aggregation: definition.aggregation,
        expression: definition.column ?? '*',
        description: definition.label,
        definition: JSON.stringify(definition),
        useYn: 'Y',
      }),
    );
  };

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-bi-formula-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    // The margin fixture is loaded through the real CSV import path.
    const margin = studioDemoData('margin');
    const imported = await worker.importFile({
      originalname: margin.filename,
      buffer: margin.csv,
    });
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Database, Metric, User, EnterpriseMembership, SourceCatalogEntry],
    }).initialize();
    const sources = db.getRepository(Database);
    const connectionConfig = (fileVersion = true) =>
      JSON.stringify({
        client: 'duckdb',
        connection: { filename: imported.filename },
        ...(fileVersion
          ? {
              fileVersions: [
                {
                  id: path.basename(path.dirname(imported.filename)),
                  filename: imported.filename,
                  originalname: margin.filename,
                  rows: margin.rows,
                  uploadedAt: new Date().toISOString(),
                  sha256: createHash('sha256').update(margin.csv).digest('hex'),
                },
              ],
            }
          : {}),
      });
    await sources.save(
      sources.create({
        id: 1,
        ownerId: actor,
        name: 'VM margin demo',
        engine: 'duckdb',
        type: 'FILE',
        timezone: 'UTC',
        connectionConfig: connectionConfig(),
      }),
    );
    // A second owned source proves that operands may not be remapped across sources.
    await sources.save(
      sources.create({
        id: 2,
        ownerId: actor,
        name: 'Other owned source',
        engine: 'duckdb',
        type: 'FILE',
        timezone: 'UTC',
        connectionConfig: connectionConfig(false),
      }),
    );
    connection = new ConnectionService(sources, {} as any, worker);
    bi = new BiService(db, new SourceAccessService(db), connection, { save: jest.fn() } as any);
    segment = new BiSegmentService(bi, connection);
  });

  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await db.manager.save(User, {
      id: actor,
      userId: 'formula-owner',
      email: 'formula-owner@example.invalid',
      password: 'unused',
      active: true,
      authVersion: 3,
    });
    await db.manager.save(User, {
      id: stranger,
      userId: 'formula-stranger',
      email: 'formula-stranger@example.invalid',
      password: 'unused',
      active: true,
      authVersion: 0,
    });
    await db.manager.clear(SourceCatalogEntry);
    await metrics().clear();
    await saveMetric(1, storedDefinition('매출', 'revenue'));
    await saveMetric(2, storedDefinition('비용', 'cost'));
    await saveMetric(3, storedDefinition('금액', 'amount', 2));
    await saveMetric(
      4,
      storedDefinition('건수', '*', 1, { aggregation: 'COUNT', unit: 'count', decimalPlaces: 0 }),
    );
    // Restoring source metadata updates updatedAt, which is part of the profile revision.
    // Capture each case's current baseline after the preceding case has finished cleanup.
    profile = await bi.profile(1, actor);
    sourceRevision = await connection.duckDBVersion(1);
  });

  it('previews the margin formula at the current source revision without writing', async () => {
    const before = await metricCount();
    const preview = await bi.previewFormula(formulaBody(marginRatio()), actor);
    expect(preview.sourceRevision).toBe(profile.dataVersion);
    expect(Number(preview.rows[0].value)).toBeCloseTo(MARGIN_PERCENT, 6);
    expect(preview.definition).toMatchObject({
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 1,
      tableName: 'uploaded_data',
      aggregation: 'FORMULA',
      column: '*',
      unit: '%',
      decimalPlaces: 2,
      numberNotation: 'plain',
    });
    // The frozen snapshot records exactly the referenced versions and keeps stored units verbatim.
    expect(
      preview.definition.formula.operands.map((operand: any) => [
        operand.id,
        operand.definitionVersion,
      ]),
    ).toEqual([
      [1, 1],
      [2, 1],
    ]);
    expect(
      preview.definition.formula.operands.map((operand: any) => operand.definition.unit),
    ).toEqual(['USD', 'USD']);
    expect(Object.keys(preview.definition.formula).sort()).toEqual([
      'expression',
      'operands',
      'unit',
    ]);
    const expression = metricExpression(preview.definition, profile);
    expect(expression).toContain('SUM("revenue")');
    expect(expression).toContain('SUM("cost")');
    expect(expression).toContain('NULLIF(');
    expect(expression).toContain('* 100');
    expect(await metricCount()).toBe(before);
  });

  it('rejects new direct and nested self-ratios without writes or formula execution', async () => {
    const before = await metricCount();
    const query = jest.spyOn(connection, 'queryDuckDB');
    const selfRatio = { op: 'ratio', left: reference(1), right: reference(1), scale: 100 };
    for (const expression of [
      selfRatio,
      { op: 'add', left: selfRatio, right: marginRatio() },
      {
        op: 'ratio',
        left: { op: 'subtract', left: reference(1), right: reference(2) },
        right: { right: reference(2), op: 'subtract', left: reference(1) },
        scale: 100,
      },
    ]) {
      await expect(bi.previewFormula(formulaBody(expression), actor)).rejects.toMatchObject(
        selfRatioError,
      );
      await expect(bi.createMetric(formulaBody(expression), actor)).rejects.toMatchObject(
        selfRatioError,
      );
    }
    // Source profiling may query the file; the rejected formula must never execute.
    expect(query.mock.calls.filter(([, sql]) => / AS value FROM /i.test(sql))).toHaveLength(0);
    expect(await metricCount()).toBe(before);
  });

  it('rejects distinct saved metric IDs compiling to identical arithmetic', async () => {
    await saveMetric(
      5,
      storedDefinition('매출 별칭', 'revenue', 1, {
        definitionVersion: 2,
        unit: '$',
        decimalPlaces: 4,
      }),
    );
    const before = await metricCount();
    const body = formulaBody({
      op: 'ratio',
      left: reference(1),
      right: reference(5, 2),
      scale: 100,
    });
    // Isolate preparation from source profiling: arithmetic validation itself must not query.
    const query = jest.spyOn(connection, 'queryDuckDB');
    const profiling = jest.spyOn(bi, 'profile').mockResolvedValue(profile);
    await expect(bi.prepareFormula(body, actor)).rejects.toMatchObject(selfRatioError);
    expect(query).not.toHaveBeenCalled();
    profiling.mockRestore();
    await expect(bi.previewFormula(body, actor)).rejects.toMatchObject(selfRatioError);
    await expect(bi.createMetric(body, actor)).rejects.toMatchObject(selfRatioError);
    expect(await metricCount()).toBe(before);
  });

  it('keeps a historical stored self-ratio readable and usable as an exact saved metric', async () => {
    const expression = { op: 'ratio', left: reference(1), right: reference(1), scale: 100 };
    const historical = {
      ...storedDefinition('기존 자기 비율', '*'),
      aggregation: 'FORMULA',
      unit: '%',
      formula: pinMetricFormula(
        expression,
        [
          {
            id: 1,
            definitionVersion: 1,
            definition: storedDefinition('매출', 'revenue'),
          },
        ],
        profile,
      ),
    };
    await saveMetric(5, historical);
    const before = await metricCount();
    const row = await metricRow(5);
    expect((await bi.metrics(1, actor)).find(metric => metric.id === 5).definition).toEqual(
      historical,
    );
    const prepared = await bi.prepare(
      { sourceId: 1, metricId: 5, title: '기존 비율', chart: 'number' },
      actor,
    );
    expect(prepared.definition).toEqual(historical);
    expect(prepared.draft.widgets[0].sql).toBe(
      `SELECT ${metricExpression(historical, profile)} AS value FROM source`,
    );
    expect((await metricRow(5)).definition).toBe(row.definition);
    expect(await metricCount()).toBe(before);
  });

  it.each([
    'epoch',
    'inactive-actor',
    'source-file',
    'source-owner',
    'operand-version',
    'operand-definition',
    'operand-inactive',
  ] as const)(
    'rejects %s changes after FORMULA preparation without writing a metric',
    async change => {
      const before = await metricCount();
      const source = await db.manager.findOneByOrFail(Database, { id: 1 });
      let prepared = false;
      const prepare = bi.prepareFormula.bind(bi);
      const spy = jest.spyOn(bi, 'prepareFormula').mockImplementationOnce(async (...args) => {
        const result = await prepare(...args);
        prepared = true;
        if (change === 'epoch') await db.manager.update(User, actor, { authVersion: 4 });
        if (change === 'inactive-actor') await db.manager.update(User, actor, { active: false });
        if (change === 'source-file')
          await db.manager.update(Database, 1, { connectionConfig: source.connectionConfig + ' ' });
        if (change === 'source-owner') await db.manager.update(Database, 1, { ownerId: stranger });
        if (change === 'operand-version')
          await db.manager.update(Metric, 1, {
            definition: JSON.stringify({
              ...storedDefinition('매출', 'revenue'),
              definitionVersion: 2,
            }),
          });
        if (change === 'operand-definition')
          await db.manager.update(Metric, 1, {
            definition: JSON.stringify(storedDefinition('다른 계산', 'profit')),
          });
        if (change === 'operand-inactive') await db.manager.update(Metric, 1, { useYn: 'N' });
        return result;
      });
      try {
        await expect(bi.createMetric(formulaBody(marginRatio()), actor, 3)).rejects.toMatchObject({
          status:
            change === 'epoch'
              ? 401
              : ['inactive-actor', 'operand-inactive'].includes(change)
              ? 403
              : 409,
        });
        expect(prepared).toBe(true);
        expect(await metricCount()).toBe(before);
      } finally {
        spy.mockRestore();
        await db.manager.update(Database, 1, {
          ownerId: source.ownerId,
          connectionConfig: source.connectionConfig,
        });
      }
    },
  );
  it('persists FORMULA only in the active metadata transaction with the request epoch', async () => {
    const save = EntityManager.prototype.save;
    const spy = jest
      .spyOn(EntityManager.prototype, 'save')
      .mockImplementation(async function (...args: any[]) {
        if (args[0] === Metric) expect(this.queryRunner?.isTransactionActive).toBe(true);
        return save.apply(this, args);
      });
    try {
      await bi.createMetric(formulaBody(marginRatio()), actor, 3);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
  it('keeps historical native FORMULA operands when a current catalog declares their columns categories', async () => {
    await db.manager.insert(SourceCatalogEntry, {
      sourceId: 1,
      version: 1,
      actorId: actor,
      schemaRevision: businessSchemaRevision(profile),
      sourceRevision: profile.dataVersion,
      metadata: JSON.stringify({
        label: 'Catalog',
        description: '',
        columns: profile.columns.map(c => ({
          column: c.name,
          label: c.name,
          description: '',
          unit: '',
          dateFormat: '',
          classification: '',
          businessType: ['revenue', 'cost'].includes(c.name) ? 'category' : 'auto',
        })),
      }),
    });
    const created = await bi.createMetric(formulaBody(marginRatio()), actor, 3);
    const prepared = await bi.prepare(
      { sourceId: 1, metricId: created.id, title: 'Native formula', chart: 'number' },
      actor,
      undefined,
      3,
    );
    expect(prepared.draft.widgets[0].sql).toBe(
      `SELECT ${metricExpression(created.definition, profile)} AS value FROM source`,
    );
    expect(
      created.definition.formula.operands.every(o => o.definition.businessBasis === undefined),
    ).toBe(true);
    const currentBasis = await captureBusinessBasis(db.manager, 1, profile);
    const projected = businessProfile(profile, currentBasis);
    expect(projected.columns.find(c => c.name === 'revenue').numeric).toBe(false);
    expect(metricExpression(created.definition, projected)).toBe(
      metricExpression(created.definition, profile),
    );
  });
  it('rejects stale revisions, unusable operands and client-supplied snapshot fields before writing', async () => {
    const before = await metricCount();
    await expect(
      bi.previewFormula(
        formulaBody(marginRatio(), { expectedSourceRevision: 'f'.repeat(64) }),
        actor,
      ),
    ).rejects.toThrow(/원본 버전이 변경되었습니다/);
    await expect(
      bi.previewFormula(
        formulaBody({ op: 'add', left: reference(1, 2), right: reference(2) }),
        actor,
      ),
    ).rejects.toThrow(/참조 지표가 변경되었습니다/);
    await expect(
      bi.previewFormula(formulaBody({ op: 'add', left: reference(3), right: reference(2) }), actor),
    ).rejects.toThrow(/같은 소스의 활성 저장 지표/);
    await expect(
      bi.previewFormula(
        formulaBody({
          op: 'add',
          left: { ...reference(1), sql: 'SELECT 1' },
          right: reference(2),
        }),
        actor,
      ),
    ).rejects.toThrow(/formula reference has an unsupported field: sql/);
    await expect(
      bi.previewFormula(formulaBody({ op: 'add', left: reference(1), right: reference(4) }), actor),
    ).rejects.toThrow(/must share one unit/);
    // The unit is derived from the referenced definitions, never supplied by the client.
    await expect(
      bi.previewFormula(formulaBody(marginRatio(), { unit: 'USD' }), actor),
    ).rejects.toThrow(/계산 지표 요청을 확인해 주세요/);
    await expect(bi.previewFormula(formulaBody(marginRatio()), stranger)).rejects.toThrow(
      ForbiddenException,
    );
    expect(await metricCount()).toBe(before);
  });

  it('fails closed on FORMULA operands, constants and injected operator fields', async () => {
    const created = await bi.createMetric(formulaBody(marginRatio()), actor);
    const before = await metricCount();
    // A persisted FORMULA is not an allowed operand snapshot, so it cannot nest into another formula.
    const nested = { op: 'add', left: reference(created.id), right: reference(1) };
    await expect(bi.previewFormula(formulaBody(nested), actor)).rejects.toThrow(
      /operand definition has an unsupported field: formula/,
    );
    await expect(bi.createMetric(formulaBody(nested), actor)).rejects.toThrow(
      /operand definition has an unsupported field: formula/,
    );
    await expect(
      bi.previewFormula(formulaBody({ op: 'add', left: reference(1), right: { value: 1 } }), actor),
    ).rejects.toThrow(/formula node needs metricId or op/);
    await expect(
      bi.previewFormula(
        formulaBody({ op: 'add', left: reference(1), right: reference(2), sql: 'SELECT 1' }),
        actor,
      ),
    ).rejects.toThrow(/formula operator has an unsupported field: sql/);
    expect(await metricCount()).toBe(before);
  });

  it('persists one frozen formula and serves one canonical SQL from prepare, preview and segments', async () => {
    const before = await metricCount();
    const created = await bi.createMetric(formulaBody(marginRatio()), actor);
    expect(created).toMatchObject({
      label: '마진율',
      definitionVersion: 1,
      definition: { aggregation: 'FORMULA', unit: '%' },
    });
    expect(await metricCount()).toBe(before + 1);
    expect(await metricRow(created.id)).toMatchObject({
      aggregation: 'FORMULA',
      expression: 'structured_formula',
      databaseId: 1,
      useYn: 'Y',
    });
    const expression = metricExpression(created.definition, profile);
    // The saved metric reaches the shared catalog and compiles to the same canonical expression.
    expect((await bi.metrics(1, actor)).map((metric: any) => metric.id)).toContain(created.id);
    const prepared = await bi.prepare(
      { sourceId: 1, metricId: created.id, title: '마진율', chart: 'number' },
      actor,
    );
    expect(prepared.draft.widgets[0].sql).toBe(`SELECT ${expression} AS value FROM source`);
    expect(prepared.definition).toEqual(created.definition);
    const preview = await bi.previewFormula(formulaBody(marginRatio()), actor);
    expect(metricExpression(preview.definition, profile)).toBe(expression);
    // The segment endpoint extracts this same expression for its KPIs, groups and details.
    const result = await segment.segments(
      {
        sourceId: 1,
        sourceRevision,
        dimensionColumn: 'company',
        measureIds: [created.id],
        conditions: [{ measureId: created.id, operator: 'gte', value: 0 }],
        trendGrain: 'day',
        page: 0,
        pageSize: 5,
      },
      actor,
    );
    expect(result.scope.totalGroups).toBe('6');
    expect(result.details.totalRows).toBe('18');
    expect(result.kpis[0]).toMatchObject({ id: created.id, unit: '%', decimalPlaces: 2 });
    const direct = (
      await connection.queryDuckDB(1, `SELECT ${expression} AS value FROM uploaded_data`)
    ).datas[0].value;
    expect(Number(direct)).toBeCloseTo(MARGIN_PERCENT, 6);
    expect(Number(result.kpis[0].value)).toBeCloseTo(Number(direct), 9);
    expect(result.groups).toHaveLength(6);
    for (const group of result.groups) {
      const scoped = (
        await connection.queryDuckDB(
          1,
          `SELECT ${expression} AS value FROM uploaded_data WHERE "company" = ?`,
          [group.category],
        )
      ).datas[0].value;
      expect(group.values[0].id).toBe(created.id);
      expect(Number(group.values[0].value)).toBeCloseTo(Number(scoped), 9);
    }
  });

  it('keeps a created formula frozen when a referenced definition changes and rejects a new create at the old version', async () => {
    const created = await bi.createMetric(formulaBody(marginRatio()), actor);
    const expression = metricExpression(created.definition, profile);
    const first = await bi.prepare(
      { sourceId: 1, metricId: created.id, title: '마진율', chart: 'number' },
      actor,
    );
    const storedBefore = (await metricRow(created.id)).definition;
    // The referenced base metric is redefined in place without a version bump.
    await saveMetric(1, storedDefinition('이익', 'profit'));
    expect((await metricRow(created.id)).definition).toBe(storedBefore);
    const second = await bi.prepare(
      { sourceId: 1, metricId: created.id, title: '마진율', chart: 'number' },
      actor,
    );
    expect(second.draft.widgets[0].sql).toBe(first.draft.widgets[0].sql);
    expect(second.draft.widgets[0].sql).toBe(`SELECT ${expression} AS value FROM source`);
    const value = (
      await connection.queryDuckDB(1, `SELECT ${expression} AS value FROM uploaded_data`)
    ).datas[0].value;
    expect(Number(value)).toBeCloseTo(MARGIN_PERCENT, 6);
    // A brand new formula still pointing at the previous definition version is a conflict.
    await saveMetric(1, { ...storedDefinition('이익', 'profit'), definitionVersion: 2 });
    const before = await metricCount();
    await expect(bi.createMetric(formulaBody(marginRatio()), actor)).rejects.toThrow(
      ConflictException,
    );
    expect(await metricCount()).toBe(before);
    const next = await bi.createMetric(
      formulaBody({
        op: 'ratio',
        left: { op: 'subtract', left: reference(1, 2), right: reference(2) },
        right: reference(1, 2),
        scale: 100,
      }),
      actor,
    );
    expect(
      next.definition.formula.operands.map((operand: any) => [
        operand.id,
        operand.definitionVersion,
      ]),
    ).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it('rejects forged persisted snapshots and keeps the semantic catalog limited to valid formulas', async () => {
    const created = await bi.createMetric(formulaBody(marginRatio()), actor);
    const valid = JSON.parse((await metricRow(created.id)).definition);
    const forgedSql = JSON.parse(JSON.stringify(valid));
    forgedSql.formula.operands[0].definition.sql = 'SELECT 1';
    const forgedUnit = JSON.parse(JSON.stringify(valid));
    forgedUnit.formula.unit = 'USD';
    const forgedSqlId = (await saveMetric(90, forgedSql)).id;
    const forgedUnitId = (await saveMetric(91, forgedUnit)).id;
    await expect(
      bi.prepare({ sourceId: 1, metricId: forgedSqlId, title: '위조', chart: 'number' }, actor),
    ).rejects.toThrow(/operand definition has an unsupported field: sql/);
    await expect(
      bi.prepare({ sourceId: 1, metricId: forgedUnitId, title: '위조', chart: 'number' }, actor),
    ).rejects.toThrow(/frozen formula unit does not match its operands/);
    const rows = await metrics().find({ where: { useYn: 'Y' } });
    const catalog = semanticCatalog(rows, profile);
    const ids = catalog.map((entry: any) => entry.id);
    expect(ids).toContain(created.id);
    expect(ids).not.toContain(forgedSqlId);
    expect(ids).not.toContain(forgedUnitId);
    // A metric that belongs to another source is never a candidate for this profile.
    expect(ids).not.toContain(3);
    expect(catalog.find((entry: any) => entry.id === created.id).definition).toMatchObject({
      aggregation: 'FORMULA',
      column: '*',
      unit: '%',
    });
    // New client-supplied FORMULA definitions stay denied; only persisted replay is allowed.
    const fields = { ...valid };
    for (const key of ['schemaVersion', 'definitionVersion', 'sourceId', 'tableName'])
      delete fields[key];
    expect(() => normalizeMetric(fields, profile)).toThrow(BadRequestException);
    expect(normalizeMetric(fields, profile, true)).toMatchObject({
      aggregation: 'FORMULA',
      column: '*',
      unit: '%',
      decimalPlaces: 2,
    });
  });
});
