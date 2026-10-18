import { DataSource } from 'typeorm';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import {
  assertBusinessBasisCurrent,
  businessDateExpressions,
  businessDimensionExpression,
  businessExecutionIdentity,
  businessProfile,
  businessSchemaRevision,
  captureBusinessBasis,
  maskBusinessDateExpressions,
  normalizeBusinessBasis,
  resolveBusinessBasis,
  sliceBusinessBasis,
} from './semantic-business-basis';
import { validateDraft, validateSourceSql } from '../ai/dashboard-draft';

const profile = {
  sourceId: 1,
  supported: true,
  columns: [
    { name: 'code', type: 'INTEGER', numeric: true, temporal: false },
    { name: 'amount', type: 'DECIMAL(38,18)', numeric: true, temporal: false },
    { name: 'day', type: 'VARCHAR', numeric: false, temporal: false },
  ],
};
const metadata = (format = 'YYYY/MM/DD') => ({
  label: 'Business source',
  description: 'Frozen metadata',
  columns: profile.columns.map(c => ({
    column: c.name,
    label: `Business ${c.name}`,
    description: '',
    unit: c.name === 'amount' ? 'KRW' : '',
    businessType: c.name === 'code' ? 'category' : c.name === 'day' ? 'date' : 'number',
    dateFormat: c.name === 'day' ? format : '',
    classification: '',
    ...(c.name === 'amount' ? { classificationRef: { organizationId: 7, id: 5, version: 3 } } : {}),
  })),
});
describe('frozen business creation basis', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [SourceCatalogEntry],
      synchronize: true,
    }).initialize();
  });
  afterEach(async () => db?.destroy());
  const entry = (version = 1, sourceId = 1, format = 'YYYY/MM/DD') =>
    db.manager.save(SourceCatalogEntry, {
      sourceId,
      version,
      actorId: 7,
      schemaRevision: businessSchemaRevision(profile),
      sourceRevision: 'f'.repeat(64),
      metadata: JSON.stringify(metadata(format)),
    });
  it('captures canonical typed context without changing the native profile or querying a current classification registry', async () => {
    expect(await captureBusinessBasis(db.manager, 1, profile)).toBeUndefined();
    await entry();
    const basis = await captureBusinessBasis(db.manager, 1, profile);
    const projected = businessProfile(profile, basis);
    expect(projected.columns.find(c => c.name === 'code')).toMatchObject({
      numeric: false,
      dimension: true,
      nativeNumeric: true,
      label: 'Business code',
    });
    expect(projected.columns.find(c => c.name === 'day')).toMatchObject({
      type: 'VARCHAR',
      temporal: true,
      dateFormat: 'YYYY/MM/DD',
    });
    expect(profile.columns.find(c => c.name === 'code').numeric).toBe(true);
    expect(profile.columns.find(c => c.name === 'day').temporal).toBe(false);
    expect(basis.columns.find(c => c.column === 'amount').classificationRef).toEqual({
      organizationId: 7,
      id: 5,
      version: 3,
    });
  });
  it('resolves only exact parent history and used columns, preserving V1 after V2', async () => {
    await entry();
    const basis = sliceBusinessBasis(await captureBusinessBasis(db.manager, 1, profile), [
      'day',
      'amount',
    ]);
    await entry(2, 1, 'YYYYMMDD');
    expect(await resolveBusinessBasis(db.manager, 1, profile, basis, ['day', 'amount'])).toEqual(
      basis,
    );
    await expect(assertBusinessBasisCurrent(db.manager, 1, profile, basis)).rejects.toMatchObject({
      status: 409,
    });
    await expect(resolveBusinessBasis(db.manager, 2, profile, basis)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      resolveBusinessBasis(db.manager, 1, profile, basis, ['code']),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      resolveBusinessBasis(db.manager, 1, { ...profile, columns: profile.columns.slice(1) }, basis),
    ).rejects.toMatchObject({ status: 409 });
    await db.manager.delete(SourceCatalogEntry, { sourceId: 1, version: 1 });
    await expect(resolveBusinessBasis(db.manager, 1, profile, basis)).rejects.toMatchObject({
      status: 409,
    });
  });
  it.each(['label', 'nativeType', 'unit', 'classificationRef'])(
    'rejects forged historical %s instead of native fallback',
    async field => {
      await entry();
      const basis = await captureBusinessBasis(db.manager, 1, profile);
      const forged = JSON.parse(JSON.stringify(basis));
      const column = forged.columns.find(c => c.column === 'amount');
      column[field] =
        field === 'classificationRef'
          ? { organizationId: 99, id: 5, version: 3 }
          : field === 'nativeType'
          ? 'INTEGER'
          : 'forged';
      await expect(resolveBusinessBasis(db.manager, 1, profile, forged)).rejects.toMatchObject({
        status: 409,
      });
    },
  );
  it('detects a catalog appearing during new native creation but keeps old absent basis native', async () => {
    await assertBusinessBasisCurrent(db.manager, 1, profile, undefined);
    await entry();
    await expect(
      assertBusinessBasisCurrent(db.manager, 1, profile, undefined),
    ).rejects.toMatchObject({ status: 409 });
    expect(await resolveBusinessBasis(db.manager, 1, profile, undefined)).toBeUndefined();
  });
  it('excludes display metadata from computation identity and ignores unused declarations', async () => {
    await entry();
    const basis = await captureBusinessBasis(db.manager, 1, profile);
    const changed = JSON.parse(JSON.stringify(basis));
    changed.columns.find(c => c.column === 'amount').label = 'Renamed';
    expect(businessExecutionIdentity(basis, ['amount'])).toEqual(
      businessExecutionIdentity(changed, ['amount']),
    );
    changed.columns.find(c => c.column === 'day').dateFormat = 'YYYYMMDD';
    expect(businessExecutionIdentity(basis, ['amount'])).toEqual(
      businessExecutionIdentity(changed, ['amount']),
    );
    expect(businessExecutionIdentity(basis, ['day'])).not.toEqual(
      businessExecutionIdentity(changed, ['day']),
    );
  });
  it('rejects accessors before reading them or JSON serializing untrusted fields', () => {
    let called = false;
    const bad = {
      schemaVersion: 1,
      catalogVersion: 1,
      schemaRevision: 'a'.repeat(64),
      get columns() {
        called = true;
        return [];
      },
    };
    expect(() => normalizeBusinessBasis(bad)).toThrow();
    expect(called).toBe(false);
  });
  it.each(['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD'])(
    'accepts only the exact compiled %s expression in the unchanged SELECT grammar',
    async format => {
      await entry(1, 1, format);
      const basis = sliceBusinessBasis(await captureBusinessBasis(db.manager, 1, profile), ['day']);
      const expression = businessDimensionExpression(profile, basis, 'day');
      const sql = `SELECT ${expression} AS dimension, SUM("amount") AS value FROM source GROUP BY ${expression} ORDER BY dimension LIMIT 500`;
      expect(() => validateSourceSql(sql)).toThrow();
      expect(validateSourceSql(sql, basis)).toBe(sql);
      expect(maskBusinessDateExpressions(sql, basis)).toBe(
        'SELECT "day" AS dimension, SUM("amount") AS value FROM source GROUP BY "day" ORDER BY dimension LIMIT 500',
      );
      expect(() =>
        validateSourceSql(sql.replace("ELSE error('Invalid business date')", 'ELSE NULL'), basis),
      ).toThrow();
      const literal = `SELECT '${expression.replace(
        /'/g,
        "''",
      )}' AS dimension, COUNT(*) AS value FROM source`;
      expect(maskBusinessDateExpressions(literal, basis)).toBe(literal);
      expect(() =>
        validateSourceSql(`SELECT system.${expression} AS dimension FROM source`, basis),
      ).toThrow();
      expect(() =>
        validateSourceSql(`SELECT ${Array(50).fill(expression).join(',')} FROM source`, basis),
      ).toThrow();
      const draft = validateDraft({
        databaseId: 1,
        businessBasis: basis,
        title: 'Business dates',
        explanation: 'Frozen',
        widgets: [
          {
            title: 'Daily',
            description: '',
            type: 'CHART_LINE',
            sql,
            valueField: 'value',
            categoryField: 'dimension',
            businessBasis: basis,
          },
        ],
      });
      expect(draft.businessBasis).toEqual(basis);
      expect(draft.widgets[0].businessBasis).toEqual(basis);
      expect(businessDateExpressions(basis)).toEqual([{ column: 'day', expression }]);
    },
  );
});
