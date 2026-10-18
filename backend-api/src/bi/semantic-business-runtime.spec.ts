jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DuckDBInstance } from '@duckdb/node-api';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { ConnectionService } from '../connection/connection.service';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { Database } from '../database/entities/database.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Metric } from '../metric/entities/metric.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { BiService } from './bi.service';
import { compileMetricWidget } from './structured-widget';
import { serializeMetadataWork } from '../common/metadata-work';
import {
  captureBusinessBasis,
  resolveBusinessBasis,
  assertBusinessBasisCurrent,
  sliceBusinessBasis,
  businessProfile,
  businessDimensionExpression,
  businessExecutionIdentity,
  businessDateExpressions,
  validateBasisBusinessDates,
} from './semantic-business-basis';
import { metricFields } from './metric-expression';

const rows = [
  { category: '101', amount: 10, day: '2024-02-29' },
  { category: '102', amount: 20, day: '2024-02-29' },
  { category: '101', amount: 30, day: '2024-03-01' },
  { category: null, amount: null, day: null },
];
const formats = [
  ['iso_day', 'YYYY-MM-DD'],
  ['slash_day', 'YYYY/MM/DD'],
  ['compact_day', 'YYYYMMDD'],
] as const;
const ref = { organizationId: 1, id: 7, version: 1 };
const amountDefinition = {
  label: 'Revenue',
  aggregation: 'SUM',
  column: 'amount',
  unit: 'USD',
  decimalPlaces: 2,
  numberNotation: 'plain',
};

describe('FR015 semantic business basis actual SQLite/DuckDB independent oracle', () => {
  jest.setTimeout(30000);
  let root: string,
    filename: string,
    replacementFilename: string,
    db: DataSource,
    worker: DuckDBService,
    connection: ConnectionService,
    bi: BiService,
    ai: AiDashboardService,
    schema: Array<{ name: string; type: string }>;
  const previousDirectory = process.env.FILE_UPLOAD_DIR;
  const schemaRevision = () =>
    createHash('sha256')
      .update(JSON.stringify(schema.map(column => ({ column: column.name, type: column.type }))))
      .digest('hex');
  const metadata = (version = 1) => ({
    label: 'Synthetic business basis',
    description: '',
    columns: schema.map(column => ({
      column: column.name,
      label:
        column.name === 'amount' ? (version === 1 ? 'Revenue' : 'Revenue renamed') : column.name,
      description: column.name === 'unused_note' ? 'Synthetic unselected note' : '',
      unit: column.name === 'amount' ? 'USD' : '',
      businessType:
        column.name === 'category_code'
          ? 'category'
          : column.name === 'amount'
          ? 'number'
          : column.name === 'native_day' || formats.some(([name]) => name === column.name)
          ? 'date'
          : 'auto',
      dateFormat:
        formats.find(([name]) => name === column.name)?.[1] ??
        (column.name === 'native_day' ? 'native' : ''),
      classification: column.name === 'category_code' ? 'Historical category name' : '',
      ...(column.name === 'category_code' ? { classificationRef: ref } : {}),
    })),
  });
  const append = async (version = 1, value = metadata(version), sourceId = 1) => {
    await db.manager.insert(SourceCatalogEntry, {
      sourceId,
      version,
      actorId: 7,
      schemaRevision: schemaRevision(),
      sourceRevision: 'own-immutable-file',
      metadata: JSON.stringify(value),
    });
  };
  const raw = (sql: string, bindings: any[] = []) => connection.queryDuckDB(1, sql, bindings);
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-semantic-business-'));
    process.env.FILE_UPLOAD_DIR = root;
    const directory = path.join(root, randomUUID());
    fs.mkdirSync(directory, { mode: 0o700 });
    filename = path.join(directory, 'data.duckdb');
    const instance = await DuckDBInstance.create(filename),
      native = await instance.connect();
    try {
      await native.run(
        'CREATE TABLE uploaded_data(category_code DECIMAL(38,18), amount DECIMAL(18,2), iso_day VARCHAR, slash_day VARCHAR, compact_day VARCHAR, unused_note VARCHAR, native_day DATE)',
      );
      for (const row of rows)
        await native.run('INSERT INTO uploaded_data VALUES (?, ?, ?, ?, ?, ?, ?)', [
          row.category,
          row.amount,
          row.day,
          row.day?.replace(/-/g, '/') ?? null,
          row.day?.replace(/-/g, '') ?? null,
          'Synthetic unused value',
          row.day,
        ]);
      await native.run('CREATE TABLE precision_data AS SELECT * FROM uploaded_data WHERE FALSE');
      await native.run(
        "INSERT INTO precision_data(category_code, amount) VALUES (CAST('101' AS DECIMAL(38,18)),10), (CAST('101.000000000000000001' AS DECIMAL(38,18)),20), (CAST('9007199254740993' AS DECIMAL(38,18)),30)",
      );
      await native.run(
        'CREATE TABLE validation_data AS SELECT *, CAST(NULL AS VARCHAR) AS invalid_case FROM uploaded_data WHERE FALSE',
      );
      for (const invalid of ['2023/02/29', '1900/02/29', '', '2024/2/29']) {
        for (let index = 0; index < 6; index++)
          await native.run(
            "INSERT INTO validation_data(category_code, amount, slash_day, invalid_case) VALUES (101, 10, '2024/02/29', ?)",
            [invalid],
          );
        await native.run(
          'INSERT INTO validation_data(category_code, amount, slash_day, invalid_case) VALUES (101, 10, ?, ?)',
          [invalid, invalid],
        );
      }
      await native.run('CHECKPOINT');
    } finally {
      native.closeSync();
      instance.closeSync();
    }
    const replacementDirectory = path.join(root, randomUUID());
    fs.mkdirSync(replacementDirectory);
    replacementFilename = path.join(replacementDirectory, 'data.duckdb');
    fs.copyFileSync(filename, replacementFilename);
    db = await new DataSource({
      type: 'sqlite',
      database: path.join(root, 'metadata.sqlite'),
      synchronize: true,
      entities: [
        User,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        Database,
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
        Dataset,
        Widget,
        Component,
        Metric,
        SourceCatalogEntry,
      ],
    }).initialize();
    await db.manager.insert(User, {
      id: 7,
      userId: 'semantic-business-owner',
      email: 'semantic-business@example.invalid',
      password: 'unused',
      active: true,
      authVersion: 0,
    });
    await db.manager.insert(EnterpriseMembership, {
      userId: 7,
      organizationId: 1,
      role: 'admin',
      team: '',
    });
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 7,
      name: 'Synthetic semantic business',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: JSON.stringify({ client: 'duckdb', connection: { filename } }),
    });
    worker = new DuckDBService();
    connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    const access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard), access);
    bi = new BiService(db, access, connection, ai);
    for (const type of ['BOARD_NUMERIC', 'CHART_LINE', 'CHART_COLUMN'])
      await db.manager.insert(Component, { type, title: type, option: '{}', useYn: 'Y' });
    schema = (await raw('DESCRIBE uploaded_data')).datas.map(column => ({
      name: column.column_name,
      type: column.column_type,
    }));
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const entity of [
      DashboardWidget,
      UserMapping,
      Widget,
      Dataset,
      Dashboard,
      DashboardShare,
      SourceCatalogEntry,
      Metric,
      EnterpriseAuditEvent,
    ])
      await db.getRepository(entity).clear();
    await db.manager.update(User, 7, { active: true, authVersion: 0 });
    await db.manager.update(EnterpriseMembership, 7, { organizationId: 1, role: 'admin' });
    await append();
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (db?.isInitialized) await db.destroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousDirectory === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousDirectory;
  });

  it('establishes independent raw SUM60, date30/30 and category40/20 from unchanged native source rows', async () => {
    expect((await raw('SELECT SUM(amount) AS value FROM uploaded_data')).datas).toEqual([
      { value: '60.00' },
    ]);
    expect(
      (
        await raw(
          'SELECT iso_day AS day, SUM(amount) AS value FROM uploaded_data WHERE iso_day IS NOT NULL GROUP BY iso_day ORDER BY iso_day',
        )
      ).datas,
    ).toEqual([
      { day: '2024-02-29', value: '30.00' },
      { day: '2024-03-01', value: '30.00' },
    ]);
    expect(
      (
        await raw(
          'SELECT CAST(category_code AS VARCHAR) AS category, SUM(amount) AS value FROM uploaded_data WHERE category_code IS NOT NULL GROUP BY category_code ORDER BY category_code',
        )
      ).datas,
    ).toEqual([
      { category: '101.000000000000000000', value: '40.00' },
      { category: '102.000000000000000000', value: '20.00' },
    ]);
    expect(schema.find(column => column.name === 'category_code').type).toBe('DECIMAL(38,18)');
    expect(formats.map(([name]) => schema.find(column => column.name === name).type)).toEqual([
      'VARCHAR',
      'VARCHAR',
      'VARCHAR',
    ]);
  });
  const context = async () => {
    const profile = await bi.profile(1, 7);
    const basis = await captureBusinessBasis(db.manager, 1, profile);
    return { profile, basis };
  };
  const executeWidget = async (sql: string, table = 'uploaded_data', dimension = true) =>
    (
      await raw(`WITH source AS (SELECT * FROM ${table}), result AS (${sql})
      SELECT ${
        dimension ? 'CAST(dimension AS VARCHAR) AS dimension, ' : ''
      }CAST(value AS VARCHAR) AS value FROM result${dimension ? ' ORDER BY dimension' : ''}`)
    ).datas;
  it.each(formats)(
    'executes the shared line compiler for %s (%s) with independent date30/30 oracle and native NULL',
    async column => {
      const { profile, basis } = await context();
      await validateBasisBusinessDates(profile, basis, raw);
      const used = sliceBusinessBasis(basis, ['amount', column]);
      const definition = {
        ...amountDefinition,
        businessBasis: sliceBusinessBasis(basis, ['amount']),
      };
      const widget = compileMetricWidget(
        definition,
        profile,
        'line',
        column,
        'Synthetic line',
        used,
      ).widget;
      expect(await executeWidget(widget.sql)).toEqual([
        { dimension: '2024-02-29', value: '30.00' },
        { dimension: '2024-03-01', value: '30.00' },
        { dimension: null, value: null },
      ]);
      const expression = businessDimensionExpression(profile, used, column);
      expect(businessDateExpressions(used)).toEqual([{ column, expression }]);
      // Generated SELECT/GROUP BY/ORDER BY executes above; masking syntax alone is not the oracle.
      expect(widget.sql).toContain(`GROUP BY ${expression}`);
      expect(
        (await raw('DESCRIBE uploaded_data')).datas.find(row => row.column_name === column)
          .column_type,
      ).toBe('VARCHAR');
    },
  );
  it('executes only the selected native DATE business expression in the real shared dimension compiler', async () => {
    const { profile, basis } = await context();
    const used = sliceBusinessBasis(basis, ['amount', 'native_day']);
    const widget = compileMetricWidget(
      amountDefinition,
      profile,
      'line',
      'native_day',
      'Native DATE oracle',
      used,
    ).widget;
    expect(businessDateExpressions(used).map(value => value.column)).toEqual(['native_day']);
    expect(businessDimensionExpression(profile, used, 'native_day')).toBe(
      'CAST("native_day" AS DATE)',
    );
    expect(await executeWidget(widget.sql)).toEqual([
      { dimension: '2024-02-29', value: '30.00' },
      { dimension: '2024-03-01', value: '30.00' },
      { dimension: null, value: null },
    ]);
    expect(profile.columns.find(column => column.name === 'native_day').type).toBe('DATE');
  });
  it('groups native numeric categories as 40/20 instead of summing category codes', async () => {
    const { profile, basis } = await context();
    const effective = businessProfile(profile, basis);
    expect(effective.columns.find(column => column.name === 'category_code')).toMatchObject({
      nativeNumeric: true,
      numeric: false,
      dimension: true,
      type: 'DECIMAL(38,18)',
    });
    const widget = compileMetricWidget(
      { ...amountDefinition, businessBasis: sliceBusinessBasis(basis, ['amount']) },
      profile,
      'bar',
      'category_code',
      'Category oracle',
      sliceBusinessBasis(basis, ['amount', 'category_code']),
    ).widget;
    expect(await executeWidget(widget.sql)).toEqual([
      { dimension: '101.000000000000000000', value: '40.00' },
      { dimension: '102.000000000000000000', value: '20.00' },
      { dimension: null, value: null },
    ]);
  });
  it('preserves adjacent DECIMAL categories and integers beyond JS precision through actual grouped compiler SQL', async () => {
    const { profile, basis } = await context();
    const widget = compileMetricWidget(
      amountDefinition,
      profile,
      'bar',
      'category_code',
      'Precision oracle',
      sliceBusinessBasis(basis, ['amount', 'category_code']),
    ).widget;
    expect(await executeWidget(widget.sql, 'precision_data')).toEqual([
      { dimension: '101.000000000000000000', value: '10.00' },
      { dimension: '101.000000000000000001', value: '20.00' },
      { dimension: '9007199254740993.000000000000000000', value: '30.00' },
    ]);
  });
  it('rejects category arithmetic operands for new definitions but executes COUNT/COUNT_DISTINCT', async () => {
    const { profile, basis } = await context();
    for (const aggregation of ['SUM', 'AVG', 'MIN', 'MAX', 'RATIO_SUM', 'WEIGHTED_AVG']) {
      expect(() =>
        metricFields(
          {
            ...amountDefinition,
            aggregation,
            column: 'category_code',
            denominatorColumn: 'amount',
            weightColumn: 'amount',
            scale: 1,
            businessBasis: basis,
          },
          profile,
        ),
      ).toThrow();
    }
    for (const aggregation of ['RATIO_SUM', 'WEIGHTED_AVG'])
      expect(() =>
        metricFields(
          {
            ...amountDefinition,
            aggregation,
            denominatorColumn: 'category_code',
            weightColumn: 'category_code',
            scale: 1,
            businessBasis: basis,
          },
          profile,
        ),
      ).toThrow();
    for (const [aggregation, column, expected] of [
      ['COUNT_DISTINCT', 'category_code', '2'],
      ['COUNT', '*', '4'],
    ]) {
      const widget = compileMetricWidget(
        { ...amountDefinition, aggregation, column, businessBasis: basis },
        profile,
        'number',
        undefined,
        'Count oracle',
      ).widget;
      expect(await executeWidget(widget.sql, 'uploaded_data', false)).toEqual([
        { value: expected },
      ]);
    }
    expect(await db.manager.count(Metric)).toBe(0);
  });
  it('rejects actual new category SUM creation without writes while retaining existing native SUM metric execution', async () => {
    await expect(
      bi.createMetric({ ...amountDefinition, sourceId: 1, column: 'category_code' }, 7),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(Metric)).toBe(0);
    const definition = {
      ...amountDefinition,
      schemaVersion: 1,
      definitionVersion: 1,
      sourceId: 1,
      tableName: 'uploaded_data',
      column: 'category_code',
      unit: '',
    };
    await db.manager.insert(Metric, {
      id: 1,
      databaseId: 1,
      name: 'legacy-native-sum',
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'category_code',
      useYn: 'Y',
      definition: JSON.stringify(definition),
    });
    const result = await bi.preview(
      { sourceId: 1, metricId: 1, chart: 'number', title: 'Legacy native SUM' },
      7,
    );
    expect(result.rows).toEqual([{ value: '304.000000000000000000' }]);
    expect(JSON.parse((await db.manager.findOneByOrFail(Metric, { id: 1 })).definition)).toEqual(
      definition,
    );
  });
  it('persists actual new metric basis as used subset and retains V1 after reload while new metrics capture V2', async () => {
    const { unit: omittedUnit, ...input } = amountDefinition;
    expect(omittedUnit).toBe('USD');
    const created = await bi.createMetric({ ...input, sourceId: 1 }, 7, 0);
    const original = JSON.parse(
      (await db.manager.findOneByOrFail(Metric, { id: created.id })).definition,
    );
    expect(original.unit).toBe('USD');
    expect(original.businessBasis.catalogVersion).toBe(1);
    expect(original.businessBasis.columns.map(column => column.column)).toEqual(['amount']);
    expect(JSON.stringify(original.businessBasis)).not.toMatch(
      /unused_note|classificationRef|Synthetic unselected/,
    );
    await append(2);
    await db.destroy();
    await db.initialize();
    expect(
      JSON.parse((await db.manager.findOneByOrFail(Metric, { id: created.id })).definition),
    ).toEqual(original);
    expect(
      (
        await bi.preview(
          { sourceId: 1, metricId: created.id, chart: 'number', title: 'Reloaded metric' },
          7,
        )
      ).rows,
    ).toEqual([{ value: '60.00' }]);
    const line = await bi.preview(
      {
        sourceId: 1,
        metricId: created.id,
        chart: 'line',
        dimension: 'slash_day',
        title: 'Actual Bi date preview',
      },
      7,
    );
    expect(
      line.rows.map(row => [
        row.dimension === null ? null : String(row.dimension).slice(0, 10),
        row.value,
      ]),
    ).toEqual([
      ['2024-02-29', '30.00'],
      ['2024-03-01', '30.00'],
      [null, null],
    ]);
    const fresh = await bi.createMetric({ ...input, sourceId: 1 }, 7, 0);
    expect(fresh.definition.businessBasis.catalogVersion).toBe(2);
    expect(fresh.definition.businessBasis.columns[0].label).toBe('Revenue renamed');
    const counted = await bi.createMetric(
      { ...input, sourceId: 1, aggregation: 'COUNT', column: '*' },
      7,
      0,
    );
    expect(counted.definition.unit).toBe('');
  });
  it('resolves exact historical basis after SQLite reconnect while current capture sees metadata V2', async () => {
    const { profile, basis } = await context();
    const stored = await db.manager.findOneByOrFail(SourceCatalogEntry, {
      sourceId: 1,
      version: 1,
    });
    await append(2);
    await db.destroy();
    await db.initialize();
    const restored = await resolveBusinessBasis(db.manager, 1, profile, basis, [
      'amount',
      'category_code',
    ]);
    expect(restored).toEqual(basis);
    const current = await captureBusinessBasis(db.manager, 1, profile);
    expect(current.catalogVersion).toBe(2);
    expect(current.columns.find(column => column.column === 'amount').label).toBe(
      'Revenue renamed',
    );
    expect(businessExecutionIdentity(restored, ['amount', 'category_code'])).toEqual(
      businessExecutionIdentity(current, ['amount', 'category_code']),
    );
    await expect(assertBusinessBasisCurrent(db.manager, 1, profile, basis)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      (await db.manager.findOneByOrFail(SourceCatalogEntry, { sourceId: 1, version: 1 })).metadata,
    ).toBe(stored.metadata);
  });
  it.each(['forged display', 'missing version', 'classification ref', 'schema mismatch'])(
    'rejects %s against exact real historical catalog without fallback or writes',
    async scenario => {
      const { profile, basis } = await context();
      const forged = JSON.parse(JSON.stringify(basis));
      if (scenario === 'forged display')
        forged.columns.find(column => column.column === 'amount').label = 'Forged';
      if (scenario === 'missing version') forged.catalogVersion = 99;
      if (scenario === 'classification ref')
        forged.columns.find(column => column.column === 'category_code').classificationRef.id = 8;
      const changedProfile =
        scenario === 'schema mismatch'
          ? {
              ...profile,
              columns: profile.columns.map(column =>
                column.name === 'amount' ? { ...column, type: 'DOUBLE' } : column,
              ),
            }
          : profile;
      await expect(
        resolveBusinessBasis(db.manager, 1, changedProfile, forged),
      ).rejects.toMatchObject({ status: 409 });
      expect(await db.manager.count(SourceCatalogEntry)).toBe(1);
      expect(await db.manager.count(Metric)).toBe(0);
    },
  );
  it('keeps only used columns in frozen subsets and refuses missing required column or other-source history', async () => {
    const { profile, basis } = await context();
    const subset = sliceBusinessBasis(basis, ['amount', 'slash_day', 'amount']);
    expect(subset.columns.map(column => column.column)).toEqual(['amount', 'slash_day']);
    expect(JSON.stringify(subset)).not.toMatch(
      /unused_note|Synthetic unselected|classificationRef/,
    );
    await expect(
      resolveBusinessBasis(db.manager, 1, profile, subset, ['amount', 'slash_day']),
    ).resolves.toEqual(subset);
    await expect(
      resolveBusinessBasis(db.manager, 1, profile, subset, ['category_code']),
    ).rejects.toMatchObject({ status: 409 });
    await expect(resolveBusinessBasis(db.manager, 2, profile, subset)).rejects.toMatchObject({
      status: 409,
    });
  });
  it.each(['2023/02/29', '1900/02/29', '', '2024/2/29'])(
    'finds invalid business date %j beyond five preview rows using the actual full-file validator',
    async invalid => {
      const { profile, basis } = await context();
      const subset = sliceBusinessBasis(basis, ['slash_day']);
      const query = (sql: string, bindings: unknown[] = []) =>
        raw(`WITH uploaded_data AS (SELECT * FROM validation_data WHERE invalid_case = ?) ${sql}`, [
          invalid,
          ...bindings,
        ]);
      expect((await query('SELECT slash_day FROM uploaded_data LIMIT 5')).datas).toEqual(
        Array.from({ length: 5 }, () => ({ slash_day: '2024/02/29' })),
      );
      await expect(validateBasisBusinessDates(profile, subset, query)).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'INVALID_BUSINESS_DATES',
          details: [
            { column: 'slash_day', invalidCount: '1', blankCount: invalid === '' ? '1' : '0' },
          ],
        },
      });
      expect(await db.manager.count(Metric)).toBe(0);
    },
  );
  it('lets unrelated SQLite metadata commit while actual full-date validation SQL is held outside the metadata queue', async () => {
    const { profile, basis } = await context();
    let entered: () => void, resume: () => void;
    const reached = new Promise<void>(resolve => {
      entered = resolve;
    });
    const released = new Promise<void>(resolve => {
      resume = resolve;
    });
    const pending = validateBasisBusinessDates(profile, basis, async (sql, bindings) => {
      entered();
      await released;
      return raw(sql, bindings as any[]);
    });
    await reached;
    let timer: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([
        serializeMetadataWork(db, () => append(1, metadata(), 2)),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Metadata queue held during date SQL')), 1000);
        }),
      ]);
      expect(await db.manager.count(SourceCatalogEntry)).toBe(2);
    } finally {
      clearTimeout(timer);
      resume();
      await pending;
    }
  });
  describe('actual AI service business-basis execution and final fences', () => {
    const draft = async () => {
      const { profile, basis } = await context();
      const metric = { ...amountDefinition, businessBasis: sliceBusinessBasis(basis, ['amount']) };
      return {
        databaseId: 1,
        title: 'Synthetic actual AI business preview',
        explanation: '',
        businessBasis: basis,
        widgets: [
          compileMetricWidget(metric, profile, 'number', undefined, 'Revenue').widget,
          compileMetricWidget(
            metric,
            profile,
            'line',
            'slash_day',
            'Date revenue',
            sliceBusinessBasis(basis, ['amount', 'slash_day']),
          ).widget,
        ],
      };
    };
    const storedCounts = () =>
      Promise.all(
        [Dashboard, DashboardShare, Dataset, Widget, DashboardWidget, UserMapping, Metric].map(
          entity => db.getRepository(entity).count(),
        ),
      );
    const assertPreview = (result: any) => {
      expect(result.status).toBe('SUCCESS');
      expect(result.data.widgets[0].datas).toEqual([{ value: '60.00' }]);
      expect(
        result.data.widgets[1].datas.map(row => [
          row.dimension === null ? null : String(row.dimension).slice(0, 10),
          row.value,
        ]),
      ).toEqual([
        ['2024-02-29', '30.00'],
        ['2024-03-01', '30.00'],
        [null, null],
      ]);
    };
    it('runs actual AI preview KPI60 and numeric date trend30/30 plus compiled VARCHAR-date chart without writes', async () => {
      const before = await storedCounts();
      const result: any = await ai.preview(
        { draft: await draft(), includeTrends: true, trendGrain: 'day' },
        7,
        'edit',
        0,
      );
      assertPreview(result);
      expect(result.data.widgets[0].trend).toMatchObject({ column: 'iso_day', grain: 'day' });
      expect(
        result.data.widgets[0].trend.points.map(point => [
          point.time === null ? null : String(point.time).slice(0, 10),
          point.value,
        ]),
      ).toEqual([
        ['2024-02-29', 30],
        ['2024-03-01', 30],
        [null, null],
      ]);
      expect(await storedCounts()).toEqual(before);
    });
    it('saves actual AI datasets/widgets and reloads historical V1 basis with unchanged KPI/date chart after catalog V2', async () => {
      const input = await draft();
      const saved: any = await ai.save(
        { draft: input },
        7,
        undefined,
        undefined,
        undefined,
        false,
        [],
        undefined,
        0,
      );
      expect(saved.status).toBe('SUCCESS');
      expect(await storedCounts()).toEqual([1, 1, 2, 2, 2, 1, 0]);
      const stored = await db.manager.findOneByOrFail(Dashboard, { id: saved.data.id });
      const original = stored.analysisDefinition;
      expect(JSON.parse(original).businessBasis).toEqual(input.businessBasis);
      await append(2);
      await db.destroy();
      await db.initialize();
      const loaded: any = await ai.analysis(saved.data.id, 7, true);
      expect(loaded.data.businessBasis.catalogVersion).toBe(1);
      assertPreview(
        await ai.preview({ dashboardId: saved.data.id, draft: loaded.data }, 7, 'read', 0),
      );
      expect(
        (await db.manager.findOneByOrFail(Dashboard, { id: saved.data.id })).analysisDefinition,
      ).toBe(original);
      const datasets = await db.manager.find(Dataset, { order: { id: 'ASC' } });
      expect((await raw(datasets[0].query)).datas).toEqual([{ value: '60.00' }]);
      expect(
        (await raw(datasets[1].query)).datas.map(row => [
          row.dimension === null ? null : String(row.dimension).slice(0, 10),
          row.value,
        ]),
      ).toEqual([
        ['2024-02-29', '30.00'],
        ['2024-03-01', '30.00'],
        [null, null],
      ]);
    });
    it.each(['epoch', 'organization'])(
      'denies actual AI preview result after %s changes following real KPI SQL',
      async change => {
        const input = await draft(),
          before = await storedCounts(),
          original = connection.queryDuckDB.bind(connection);
        let changed = false;
        jest.spyOn(connection, 'queryDuckDB').mockImplementation(async (...args) => {
          const result = await original(...args);
          if (!changed && /SUM\("amount"\) AS value/i.test(args[1])) {
            changed = true;
            await serializeMetadataWork(db, async () => {
              if (change === 'epoch') await db.manager.update(User, 7, { authVersion: 1 });
              else await db.manager.update(EnterpriseMembership, 7, { organizationId: 2 });
            });
          }
          return result;
        });
        await expect(ai.preview({ draft: input }, 7, 'edit', 0)).rejects.toMatchObject({
          status: change === 'epoch' ? 401 : 409,
        });
        expect(changed).toBe(true);
        expect(await storedCounts()).toEqual(before);
      },
    );
    it('rejects actual AI preview under an outer old pin after real KPI SQL and committed owned file replacement', async () => {
      const input = await draft(),
        before = await storedCounts(),
        original = connection.queryDuckDB.bind(connection);
      const source = await db.manager.findOneByOrFail(Database, { id: 1 });
      const outer = await connection.captureDuckDBSnapshot(1);
      let changed = false;
      jest.spyOn(connection, 'queryDuckDB').mockImplementation(async (...args) => {
        const result = await original(...args);
        if (!changed && /SUM\("amount"\) AS value/i.test(args[1])) {
          changed = true;
          await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
            JSON.stringify({ client: 'duckdb', connection: { filename: replacementFilename } }),
          ]);
        }
        return result;
      });
      try {
        await expect(
          outer.run(() => ai.preview({ draft: input }, 7, 'edit', 0)),
        ).rejects.toMatchObject({ status: 409 });
        expect(changed).toBe(true);
        expect(await storedCounts()).toEqual(before);
      } finally {
        jest.restoreAllMocks();
        await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
          source.connectionConfig,
        ]);
      }
    });
    it.each(['epoch', 'file'])(
      'rejects prepared actual AI save after %s changes before the real persistence transaction',
      async change => {
        const prepared = await ai.prepareSave(
          { draft: await draft() },
          7,
          undefined,
          undefined,
          false,
          [],
          undefined,
          0,
        );
        const before = await storedCounts(),
          source = await db.manager.findOneByOrFail(Database, { id: 1 });
        if (change === 'epoch') await db.manager.update(User, 7, { authVersion: 1 });
        else
          await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
            JSON.stringify({ client: 'duckdb', connection: { filename: replacementFilename } }),
          ]);
        try {
          await expect(db.transaction(manager => prepared.persist(manager))).rejects.toMatchObject({
            status: change === 'epoch' ? 401 : 409,
          });
          expect(await storedCounts()).toEqual(before);
        } finally {
          await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
            source.connectionConfig,
          ]);
        }
      },
    );
    const detailRequest = async (saved: any) => ({
      dashboardId: saved.data.id,
      draft: await draft(),
      sourceRevision: await connection.duckDBVersion(1),
      page: 0,
      pageSize: 25,
    });
    it('runs actual details SQL over the frozen basis and returns native source rows without writes', async () => {
      const saved: any = await ai.save(
        { draft: await draft() },
        7,
        undefined,
        undefined,
        undefined,
        false,
        [],
        undefined,
        0,
      );
      expect(saved.status).toBe('SUCCESS');
      const before = await storedCounts();
      const detail: any = await ai.details(await detailRequest(saved), 7, 0);
      expect(detail.status).toBe('SUCCESS');
      expect(detail.data.totalRows).toBe('4');
      expect(detail.data.datas.map(row => String(row.amount)).sort()).toEqual([
        '10.00',
        '20.00',
        '30.00',
        'null',
      ]);
      expect(await storedCounts()).toEqual(before);
    });
    it.each([
      ['epoch', 401],
      ['revoked', 403],
      ['organization', 409],
    ] as const)(
      'denies actual details after %s changes following real detail SQL',
      async (change, status) => {
        const saved: any = await ai.save(
          { draft: await draft() },
          7,
          undefined,
          undefined,
          undefined,
          false,
          [],
          undefined,
          0,
        );
        const request = await detailRequest(saved),
          before = await storedCounts(),
          original = connection.queryDuckDB.bind(connection);
        let changed = false;
        jest.spyOn(connection, 'queryDuckDB').mockImplementation(async (...args) => {
          const result = await original(...args);
          if (!changed && /ORDER BY ALL LIMIT/.test(args[1])) {
            changed = true;
            await serializeMetadataWork(db, async () => {
              if (change === 'epoch') await db.manager.update(User, 7, { authVersion: 1 });
              else if (change === 'revoked') await db.manager.update(User, 7, { active: false });
              else await db.manager.update(EnterpriseMembership, 7, { organizationId: 2 });
            });
          }
          return result;
        });
        await expect(ai.details(request, 7, 0)).rejects.toMatchObject({ status });
        expect(changed).toBe(true);
        expect(await storedCounts()).toEqual(before);
      },
    );
    it('rejects actual details after real detail SQL and committed owned file replacement', async () => {
      const saved: any = await ai.save(
        { draft: await draft() },
        7,
        undefined,
        undefined,
        undefined,
        false,
        [],
        undefined,
        0,
      );
      const request = await detailRequest(saved),
        before = await storedCounts(),
        source = await db.manager.findOneByOrFail(Database, { id: 1 }),
        original = connection.queryDuckDB.bind(connection);
      let changed = false;
      jest.spyOn(connection, 'queryDuckDB').mockImplementation(async (...args) => {
        const result = await original(...args);
        if (!changed && /ORDER BY ALL LIMIT/.test(args[1])) {
          changed = true;
          await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
            JSON.stringify({ client: 'duckdb', connection: { filename: replacementFilename } }),
          ]);
        }
        return result;
      });
      try {
        await expect(ai.details(request, 7, 0)).rejects.toMatchObject({ status: 409 });
        expect(changed).toBe(true);
        expect(await storedCounts()).toEqual(before);
      } finally {
        jest.restoreAllMocks();
        await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
          source.connectionConfig,
        ]);
      }
    });
    it.each([
      ['none', undefined],
      ['epoch', 401],
      ['file', 409],
    ] as const)(
      'keeps the real KPI SQL failure visible when the actor and file state is %s',
      async (change, status) => {
        const input = await draft(),
          before = await storedCounts(),
          source = await db.manager.findOneByOrFail(Database, { id: 1 }),
          original = connection.queryDuckDB.bind(connection);
        let failed = false;
        jest.spyOn(connection, 'queryDuckDB').mockImplementation(async (...args) => {
          if (!failed && /SUM\("amount"\) AS value/i.test(args[1])) {
            failed = true;
            if (change === 'epoch')
              await serializeMetadataWork(db, () => db.manager.update(User, 7, { authVersion: 1 }));
            if (change === 'file')
              await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
                JSON.stringify({ client: 'duckdb', connection: { filename: replacementFilename } }),
              ]);
            throw new Error('synthetic KPI SQL failure');
          }
          return original(...args);
        });
        try {
          const attempt = ai.preview({ draft: input }, 7, 'edit', 0);
          if (status === undefined)
            await expect(attempt).rejects.toThrow('synthetic KPI SQL failure');
          else await expect(attempt).rejects.toMatchObject({ status });
          expect(failed).toBe(true);
          expect(await storedCounts()).toEqual(before);
        } finally {
          jest.restoreAllMocks();
          await db.query('UPDATE "database" SET "connectionConfig" = ? WHERE "id" = 1', [
            source.connectionConfig,
          ]);
        }
      },
    );
    it('rejects a prepared update whose revision moved before the transaction and keeps the newer title', async () => {
      const saved: any = await ai.save(
        { draft: await draft() },
        7,
        undefined,
        undefined,
        undefined,
        false,
        [],
        undefined,
        0,
      );
      const prepared = await ai.prepareSave(
        {
          dashboardId: saved.data.id,
          expectedRevision: saved.data.revision,
          draft: await draft(),
        },
        7,
        undefined,
        undefined,
        false,
        [],
        undefined,
        0,
      );
      await db.manager.update(Dashboard, saved.data.id, { title: 'Newer history title' });
      const before = await storedCounts();
      await expect(db.transaction(manager => prepared.persist(manager))).rejects.toMatchObject({
        status: 409,
      });
      expect(await storedCounts()).toEqual(before);
      expect((await db.manager.findOneByOrFail(Dashboard, { id: saved.data.id })).title).toBe(
        'Newer history title',
      );
    });
  });
});
