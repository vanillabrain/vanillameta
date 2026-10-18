import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { metadataTransaction } from '../common/metadata-work';
import { DuckDBInstance } from '@duckdb/node-api';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import {
  latestConditionSemantics,
  resolveConditionSemantics,
  assertLatestConditionSemantics,
  validateConditionBusinessDates,
} from './business-condition-context';
import { AddSourceConditions1792440000000 } from '../migrations/1792440000000-add-source-conditions';
import { AddSourceConditionSemantics1792570000000 } from '../migrations/1792570000000-add-source-condition-semantics';

describe('condition business context exact catalog history', () => {
  let db: DataSource;
  const schema = [
    { name: 'amount', type: 'DOUBLE' },
    { name: 'day', type: 'VARCHAR' },
    { name: 'channel', type: 'VARCHAR' },
  ];
  const schemaRevision = createHash('sha256')
    .update(JSON.stringify(schema.map(c => ({ column: c.name, type: c.type }))))
    .digest('hex');
  const add = async (version: number, declarations: any[] = [], sourceId = 1) =>
    db.manager.save(SourceCatalogEntry, {
      sourceId,
      version,
      actorId: 7,
      schemaRevision,
      sourceRevision: 'metadata-only',
      metadata: JSON.stringify({
        label: 'Fixture',
        description: '',
        columns: schema.map(c => ({
          column: c.name,
          label: c.name,
          description: '',
          unit: '',
          businessType: 'auto',
          dateFormat: '',
          classification: '',
          ...declarations.find(d => d.column === c.name),
        })),
      }),
    });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [SourceCatalogEntry],
      synchronize: true,
    }).initialize();
  });
  afterEach(async () => db.destroy());
  it('returns undefined only for legacy/no history and keeps all-auto catalog epochs explicit', async () => {
    expect(await latestConditionSemantics(db.manager, 1, schema)).toBeUndefined();
    await add(1);
    expect(await resolveConditionSemantics(db.manager, 1, schema, undefined)).toBeUndefined();
    expect(await latestConditionSemantics(db.manager, 1, schema)).toEqual({
      schemaVersion: 1,
      catalogVersion: 1,
      columns: [],
    });
    await expect(
      assertLatestConditionSemantics(db.manager, 1, schema, undefined),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('resolves frozen exact history, sorts every non-auto declaration and detects no-op catalog epochs', async () => {
    await add(1, [
      { column: 'day', businessType: 'date', dateFormat: 'YYYY/MM/DD' },
      { column: 'amount', businessType: 'category' },
    ]);
    const frozen = await latestConditionSemantics(db.manager, 1, schema);
    expect(frozen.columns.map(c => c.column)).toEqual(['amount', 'day']);
    const metadata = (await db.manager.findOneBy(SourceCatalogEntry, { sourceId: 1, version: 1 }))
      .metadata;
    await db.manager.save(SourceCatalogEntry, {
      sourceId: 1,
      version: 2,
      actorId: 7,
      schemaRevision,
      sourceRevision: 'new-metadata-only',
      metadata,
    });
    expect(await resolveConditionSemantics(db.manager, 1, schema, frozen)).toEqual(frozen);
    await expect(
      assertLatestConditionSemantics(db.manager, 1, schema, frozen),
    ).rejects.toMatchObject({ status: 409 });
    await expect(resolveConditionSemantics(db.manager, 2, schema, frozen)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      resolveConditionSemantics(db.manager, 1, schema, {
        ...frozen,
        columns: frozen.columns.slice(0, 1),
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      resolveConditionSemantics(db.manager, 1, [{ name: 'other', type: 'DOUBLE' }], frozen),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      resolveConditionSemantics(db.manager, 1, schema, { ...frozen, catalogVersion: 999 }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it.each(['broken JSON', 'duplicate', 'missing', 'incompatible', 'bad-schema'])(
    'fails closed on corrupt history (%s)',
    async kind => {
      await add(1);
      const row = await db.manager.findOneBy(SourceCatalogEntry, { sourceId: 1, version: 1 });
      const metadata = JSON.parse(row.metadata);
      if (kind === 'duplicate') metadata.columns[1] = metadata.columns[0];
      if (kind === 'missing') metadata.columns.pop();
      if (kind === 'incompatible')
        metadata.columns[1] = { ...metadata.columns[1], businessType: 'number' };
      await db.manager.update(
        SourceCatalogEntry,
        { sourceId: 1, version: 1 },
        {
          metadata: kind === 'broken JSON' ? '{bad' : JSON.stringify(metadata),
          ...(kind === 'bad-schema' ? { schemaRevision: 'a'.repeat(64) } : {}),
        },
      );
      await expect(latestConditionSemantics(db.manager, 1, schema)).rejects.toMatchObject({
        status: 409,
      });
    },
  );
  it('queues independent history reads behind a live SQLite transaction while allowing lease reentry', async () => {
    await add(1);
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const ready = new Promise<void>(resolve => {
      entered = resolve;
    });
    const writer = metadataTransaction(db, async manager => {
      await add(2);
      expect((await latestConditionSemantics(manager, 1, schema)).catalogVersion).toBe(2);
      entered();
      await gate;
      throw new Error('fixture rollback');
    }).catch(error => {
      expect(error.message).toBe('fixture rollback');
    });
    await ready;
    let finished = false;
    const reader = latestConditionSemantics(db.manager, 1, schema).then(value => {
      finished = true;
      return value;
    });
    const exact = resolveConditionSemantics(db.manager, 1, schema, {
      schemaVersion: 1,
      catalogVersion: 2,
      columns: [],
    }).then(
      () => 0,
      error => error.status,
    );
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(finished).toBe(false);
    release();
    await writer;
    expect((await reader).catalogVersion).toBe(1);
    expect(await exact).toBe(409);
  });
  it('adds nullable semantics idempotently without rewriting legacy history and refuses destructive down', async () => {
    const runner = db.createQueryRunner();
    await new AddSourceConditions1792440000000().up(runner);
    await runner.query(
      "INSERT INTO source_condition_entry (sourceId,version,actorId,sourceRevision,definition) VALUES (1,1,7,'metadata','{}')",
    );
    const migration = new AddSourceConditionSemantics1792570000000();
    await migration.up(runner);
    await migration.up(runner);
    expect(
      (await runner.query('SELECT semanticsJSON, definition FROM source_condition_entry'))[0],
    ).toEqual({ semanticsJSON: null, definition: '{}' });
    await expect(migration.down()).rejects.toThrow('backup');
    await runner.release();
  });
});

describe('whole-source strict business date validation', () => {
  it.each(['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD'])(
    'checks all rows and handles NULL separately from blank for %s',
    async dateFormat => {
      const instance = await DuckDBInstance.create(':memory:');
      const duck = await instance.connect();
      try {
        const format = (value: string) =>
          dateFormat === 'YYYY/MM/DD'
            ? value.replace(/-/g, '/')
            : dateFormat === 'YYYYMMDD'
            ? value.replace(/-/g, '')
            : value;
        const valid = format('2024-02-29');
        await duck.run(
          `CREATE TABLE uploaded_data(day VARCHAR); INSERT INTO uploaded_data VALUES ('${valid}'), ('${valid}'), ('${valid}'), ('${valid}'), ('${valid}'), (NULL)`,
        );
        const query = async (sql: string, bindings: any[] = []) => ({
          datas: (await duck.runAndReadAll(sql, bindings)).getRowObjectsJson(),
        });
        const snapshot: any = {
          schemaVersion: 1,
          catalogVersion: 1,
          columns: [{ column: 'day', businessType: 'date', dateFormat }],
        };
        await validateConditionBusinessDates([{ name: 'day', type: 'VARCHAR' }], snapshot, query);
        await duck.run(
          `INSERT INTO uploaded_data VALUES ('${format('2023-02-29')}'), (''), ('private-invalid')`,
        );
        try {
          await validateConditionBusinessDates([{ name: 'day', type: 'VARCHAR' }], snapshot, query);
          throw new Error('expected invalid dates');
        } catch (error) {
          expect(error.getResponse()).toMatchObject({
            code: 'INVALID_BUSINESS_DATES',
            details: [{ column: 'day', invalidCount: '3', blankCount: '1' }],
          });
          expect(JSON.stringify(error.getResponse())).not.toContain('private-invalid');
        }
      } finally {
        duck.closeSync();
        instance.closeSync();
      }
    },
  );
  it('does not scan for native legacy semantics and rejects malformed count responses', async () => {
    const query = jest.fn(async () => ({ datas: [{}] }));
    await validateConditionBusinessDates([{ name: 'day', type: 'VARCHAR' }], undefined, query);
    expect(query).not.toHaveBeenCalled();
    await expect(
      validateConditionBusinessDates(
        [{ name: 'day', type: 'VARCHAR' }],
        {
          schemaVersion: 1,
          catalogVersion: 1,
          columns: [{ column: 'day', businessType: 'date', dateFormat: 'YYYY-MM-DD' }],
        },
        query,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
