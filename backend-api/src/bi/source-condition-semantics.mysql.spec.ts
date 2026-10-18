import * as fs from 'fs';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { SourceConditionEntry } from './entities/source-condition-entry.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { resolveConditionSemantics } from './business-condition-context';
import { AddSourceConditions1792440000000 } from '../migrations/1792440000000-add-source-conditions';
import { AddSourceCatalog1792300000000 } from '../migrations/1792300000000-add-source-catalog';
import { AddSourceConditionSemantics1792570000000 } from '../migrations/1792570000000-add-source-condition-semantics';

const suite = process.env.VM_QA_CONDITION_SEMANTICS_MYSQL_CONFIG ? describe : describe.skip;
suite('FR015 isolated MySQL nullable source condition semantics migration', () => {
  let db: DataSource;
  const schema = [{ name: 'amount', type: 'DOUBLE' }];
  beforeAll(async () => {
    const config = JSON.parse(
      fs.readFileSync(process.env.VM_QA_CONDITION_SEMANTICS_MYSQL_CONFIG, 'utf8'),
    );
    if (
      config.host !== '127.0.0.1' ||
      !/^vm_condition_semantics_[a-f0-9]{8,32}$/.test(config.database) ||
      !config.serverUuid
    )
      throw new Error('An explicitly owned loopback MySQL fixture is required.');
    db = await new DataSource({
      type: 'mysql',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      timezone: 'Z',
      logging: false,
      synchronize: false,
      entities: [SourceConditionEntry, SourceCatalogEntry],
    }).initialize();
    const [server] = await db.query('SELECT @@server_uuid AS uuid, DATABASE() AS db');
    if (server.uuid !== config.serverUuid || server.db !== config.database)
      throw new Error('Unexpected MySQL fixture identity.');
  });
  afterAll(async () => {
    await db?.destroy();
  });
  it('preserves legacy rows and nullable migration on repeated up without destructive rollback', async () => {
    const runner = db.createQueryRunner();
    await new AddSourceConditions1792440000000().up(runner);
    await runner.query(
      'INSERT INTO source_condition_entry (sourceId,version,actorId,sourceRevision,definition) VALUES (?,?,?,?,?)',
      [1, 1, 7, 'legacy-metadata', '{"include":null,"exclude":null}'],
    );
    const [before] = await runner.query(
      'SELECT * FROM source_condition_entry WHERE sourceId=1 AND version=1',
    );
    const migration = new AddSourceConditionSemantics1792570000000();
    await migration.up(runner);
    await migration.up(runner);
    const [after] = await runner.query(
      'SELECT * FROM source_condition_entry WHERE sourceId=1 AND version=1',
    );
    expect(after).toEqual({ ...before, semanticsJSON: null });
    const column = (await runner.getTable('source_condition_entry')).findColumnByName(
      'semanticsJSON',
    );
    expect(column).toMatchObject({ type: 'text', isNullable: true });
    await expect(migration.down()).rejects.toThrow('backup');
    await runner.release();
  });
  it('persists a new semantic version and resolves exact catalog history without rewriting the native legacy version', async () => {
    const runner = db.createQueryRunner();
    await new AddSourceCatalog1792300000000().up(runner);
    const snapshot: any = {
      schemaVersion: 1,
      catalogVersion: 1,
      columns: [{ column: 'amount', businessType: 'category', dateFormat: '' }],
    };
    await db.manager.save(SourceCatalogEntry, {
      sourceId: 1,
      version: 1,
      actorId: 7,
      schemaRevision: createHash('sha256')
        .update(JSON.stringify([{ column: 'amount', type: 'DOUBLE' }]))
        .digest('hex'),
      sourceRevision: 'metadata-only',
      metadata: JSON.stringify({
        label: 'Fixture',
        description: '',
        columns: [
          {
            column: 'amount',
            label: 'Amount',
            description: '',
            unit: '',
            businessType: 'category',
            dateFormat: '',
            classification: '',
          },
        ],
      }),
    });
    const legacy = await db.manager.findOneBy(SourceConditionEntry, { sourceId: 1, version: 1 });
    await db.manager.transaction(async manager => {
      await manager.insert(SourceConditionEntry, {
        sourceId: 1,
        version: 2,
        actorId: 7,
        sourceRevision: 'new-metadata',
        definition: JSON.stringify({
          include: { kind: 'predicate', column: 'amount', operator: 'eq', values: [10] },
          exclude: null,
        }),
        semanticsJSON: JSON.stringify(snapshot),
      });
    });
    const saved = await db.manager.findOneBy(SourceConditionEntry, { sourceId: 1, version: 2 });
    expect(saved.version).toBe(2);
    expect(
      await resolveConditionSemantics(db.manager, 1, schema, JSON.parse(saved.semanticsJSON)),
    ).toEqual(snapshot);
    expect(await db.manager.findOneBy(SourceConditionEntry, { sourceId: 1, version: 1 })).toEqual(
      legacy,
    );
    expect(legacy.semanticsJSON).toBeNull();
    expect(await db.manager.count(SourceConditionEntry)).toBe(2);
    await runner.release();
  });
});
