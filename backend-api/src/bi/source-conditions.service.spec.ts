import { Database } from '../database/entities/database.entity';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { sourceRevision } from './source-revision';
import { createHash } from 'crypto';
import { serializeMetadataWork } from '../common/metadata-work';
jest.mock('../connection/connection.service', () => ({ ConnectionService: class {} }));
import { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { SourceConditionsService } from './source-conditions.service';
import { SourceConditionEntry } from './entities/source-condition-entry.entity';
import { AddSourceConditions1792440000000 } from '../migrations/1792440000000-add-source-conditions';

describe('UC052 saved source condition context', () => {
  let db: DataSource,
    service: SourceConditionsService,
    access: any,
    revision: string,
    connection: any;
  const definition = {
    include: { kind: 'predicate', column: 'amount', operator: 'gte', values: [10] },
    exclude: null,
  };
  const fileRevision = 'f'.repeat(64);
  const request = () => ({ sourceId: 3, sourceRevision: revision, version: 0, definition });
  const addCatalog = async (
    version: number,
    amountType = 'number',
    channelType = 'auto',
    dateFormat = '',
  ) =>
    db.manager.save(SourceCatalogEntry, {
      sourceId: 3,
      version,
      actorId: 7,
      sourceRevision: revision,
      schemaRevision: createHash('sha256')
        .update(
          JSON.stringify([
            { column: 'amount', type: 'DOUBLE' },
            { column: 'channel', type: 'VARCHAR' },
          ]),
        )
        .digest('hex'),
      metadata: JSON.stringify({
        label: 'Fixture',
        description: '',
        columns: [
          {
            column: 'amount',
            label: 'Amount',
            description: '',
            unit: '',
            businessType: amountType,
            dateFormat: '',
            classification: '',
          },
          {
            column: 'channel',
            label: 'Channel',
            description: '',
            unit: '',
            businessType: channelType,
            dateFormat,
            classification: '',
          },
        ],
      }),
    });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [SourceConditionEntry, SourceCatalogEntry, Database],
      synchronize: false,
    }).initialize();
    const runner = db.createQueryRunner();
    await new AddSourceConditions1792440000000().up(runner);
    await new AddSourceConditions1792440000000().up(runner);
    await runner.release();
    await db.synchronize();
    access = {
      actor: jest.fn(),
      id: (x: any) => Number(x),
      assert: jest.fn(async (_kind, _id, actor, action) => {
        if (actor !== 7 && !(actor === 8 && action === 'read')) throw new ForbiddenException();
      }),
    };
    const sources = db.getRepository(Database);
    const source = await sources.save({
      id: 3,
      ownerId: 7,
      name: 'Synthetic',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    revision = sourceRevision(source, fileRevision);
    connection = {
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async run => run() })),
      duckDBVersion: jest.fn(async () => fileRevision),
      queryDuckDB: jest.fn(async (_id, sql) =>
        sql.startsWith('DESCRIBE')
          ? {
              datas: [
                { column_name: 'amount', column_type: 'DOUBLE' },
                { column_name: 'channel', column_type: 'VARCHAR' },
              ],
            }
          : { datas: [{ total: '10', matched: '4', excluded: '1', remaining: '3' }] },
      ),
    };
    service = new SourceConditionsService(db, access, connection);
  });
  afterEach(async () => db?.destroy());
  it('freezes source semantics across new catalog history, and explicitly adopts only after re-preview', async () => {
    await addCatalog(1);
    const sourceBefore = await db.manager.findOneBy(Database, { id: 3 });
    const read = await service.read({ sourceId: 3 }, 8);
    expect(read.semantics).toMatchObject({
      catalogVersion: 1,
      columns: [{ column: 'amount', businessType: 'number', dateFormat: '' }],
    });
    const preview = await service.preview({ ...request(), semantics: read.semantics }, 8);
    expect(preview.analysisConditions).toMatchObject({
      sourceRevision: fileRevision,
      semantics: read.semantics,
    });
    const saved = await service.save(preview.draft, 7);
    expect(
      JSON.parse(
        (await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 }))
          .semanticsJSON,
      ),
    ).toEqual(read.semantics);
    await addCatalog(2, 'category');
    expect((await service.read({ sourceId: 3 }, 8)).semantics).toEqual(read.semantics);
    await expect(
      service.preview({ ...request(), version: 1, semantics: read.semantics }, 8),
    ).resolves.toBeDefined();
    await expect(service.preview({ ...request(), version: 1 }, 8)).rejects.toMatchObject({
      status: 409,
    });
    await expect(service.save({ ...request(), version: 1 }, 7)).rejects.toMatchObject({
      status: 409,
    });
    const adopted = await service.read({ sourceId: 3, adoptCurrentSemantics: true }, 8);
    expect(adopted.semantics.catalogVersion).toBe(2);
    expect(await db.manager.count(SourceConditionEntry)).toBe(1);
    await expect(
      service.preview({ ...request(), version: saved.version, semantics: adopted.semantics }, 8),
    ).rejects.toMatchObject({ status: 400 });
    const eq = { include: { ...definition.include, operator: 'eq' }, exclude: null };
    const next = await service.preview(
      { ...request(), version: 1, semantics: adopted.semantics, definition: eq },
      8,
    );
    await service.save(next.draft, 7);
    expect((await service.read({ sourceId: 3 }, 8)).semantics).toEqual(adopted.semantics);
    expect(await db.manager.findOneBy(Database, { id: 3 })).toEqual(sourceBefore);
  });
  it('keeps pre-semantics entries native even when the latest catalog changes meaning', async () => {
    await service.save(request(), 7);
    await addCatalog(1, 'category');
    const read = await service.read({ sourceId: 3 }, 8);
    expect(read.semantics).toBeUndefined();
    expect(
      (await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 })).semanticsJSON,
    ).toBeNull();
    await expect(service.preview({ ...request(), version: 1 }, 8)).resolves.toBeDefined();
    expect(
      (await service.read({ sourceId: 3, adoptCurrentSemantics: true }, 8)).semantics
        .catalogVersion,
    ).toBe(1);
  });
  it('rejects missing/new/forged semantic bases and corrupted frozen history without fallback', async () => {
    await addCatalog(1);
    await expect(service.preview(request(), 8)).rejects.toMatchObject({ status: 409 });
    const read = await service.read({ sourceId: 3 }, 8);
    await expect(
      service.preview({ ...request(), semantics: { ...read.semantics, columns: [] } }, 8),
    ).rejects.toMatchObject({ status: 409 });
    await service.save({ ...request(), semantics: read.semantics }, 7);
    for (const semanticsJSON of ['{bad', 'null', '{}']) {
      await db.manager.update(SourceConditionEntry, { sourceId: 3, version: 1 }, { semanticsJSON });
      await expect(service.read({ sourceId: 3 }, 8)).rejects.toMatchObject({ status: 409 });
      await expect(
        service.read({ sourceId: 3, adoptCurrentSemantics: true }, 8),
      ).rejects.toMatchObject({ status: 409 });
    }
    expect(await db.manager.count(SourceConditionEntry)).toBe(1);
  });
  it('rejects even a no-op latest catalog append during population SQL', async () => {
    await addCatalog(1);
    const read = await service.read({ sourceId: 3 }, 8);
    const query = connection.queryDuckDB.getMockImplementation();
    connection.queryDuckDB.mockImplementation(async (...args) => {
      if (args[1].startsWith('WITH')) await addCatalog(2);
      return query(...args);
    });
    await expect(
      service.preview({ ...request(), semantics: read.semantics }, 8),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.save({ ...request(), semantics: read.semantics }, 7),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(SourceConditionEntry)).toBe(0);
  });
  it('rechecks adopted catalog after metadata capture without persisting an adoption', async () => {
    await service.save(request(), 7);
    await addCatalog(1);
    const current = (service as any).current.bind(service);
    const spy = jest
      .spyOn(service as any, 'current')
      .mockImplementationOnce(async (...args: any[]) => {
        const result = await current(...args);
        await addCatalog(2);
        return result;
      });
    try {
      await expect(
        service.read({ sourceId: 3, adoptCurrentSemantics: true }, 8),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      spy.mockRestore();
    }
    expect(
      (await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 })).semanticsJSON,
    ).toBeNull();
  });
  it('runs full business date SQL outside the metadata queue and requires only read permission for preview', async () => {
    await addCatalog(1, 'number', 'date', 'YYYY/MM/DD');
    const read = await service.read({ sourceId: 3 }, 8);
    let outsideRan = false;
    const query = connection.queryDuckDB.getMockImplementation();
    connection.queryDuckDB.mockImplementation(async (...args) => {
      if (args[1].includes('AS invalid_0')) {
        await serializeMetadataWork(db, async () => {
          outsideRan = true;
        });
        return { datas: [{ invalid_0: '0', blank_0: '0' }] };
      }
      return query(...args);
    });
    const draft = {
      ...request(),
      semantics: read.semantics,
      definition: {
        include: { kind: 'predicate', column: 'channel', operator: 'gte', values: ['2026-01-01'] },
        exclude: null,
      },
    };
    expect((await service.preview(draft, 8)).draft).toEqual(draft);
    expect(outsideRan).toBe(true);
    expect(
      access.assert.mock.calls.filter(call => call[2] === 8).every(call => call[3] === 'read'),
    ).toBe(true);
    expect(await db.manager.count(SourceConditionEntry)).toBe(0);
    connection.queryDuckDB.mockImplementation(async (...args) =>
      args[1].includes('AS invalid_0')
        ? { datas: [{ invalid_0: '1', blank_0: '1' }] }
        : query(...args),
    );
    await expect(service.preview(draft, 8)).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(SourceConditionEntry)).toBe(0);
  });
  it.each(['rights', 'file'])(
    'rechecks %s before returning invalid business-date counts',
    async change => {
      await addCatalog(1, 'number', 'date', 'YYYY/MM/DD');
      const read = await service.read({ sourceId: 3 }, 8);
      const query = connection.queryDuckDB.getMockImplementation();
      connection.queryDuckDB.mockImplementation(async (...args) => {
        if (args[1].includes('AS invalid_0')) {
          if (change === 'rights') access.assert.mockRejectedValue(new ForbiddenException());
          else connection.duckDBVersion.mockResolvedValue('b'.repeat(64));
          return { datas: [{ invalid_0: '1', blank_0: '1' }] };
        }
        return query(...args);
      });
      await expect(
        service.preview({ ...request(), semantics: read.semantics }, 8),
      ).rejects.toMatchObject({ status: change === 'rights' ? 403 : 409 });
      expect(await db.manager.count(SourceConditionEntry)).toBe(0);
    },
  );
  it('reads a provided native analysis independently of a semantic SourceEntry and preserves it during explicit adoption', async () => {
    await addCatalog(1, 'category');
    const source = await service.read({ sourceId: 3 }, 8);
    await service.save(
      {
        ...request(),
        semantics: source.semantics,
        definition: { include: { ...definition.include, operator: 'eq' }, exclude: null },
      },
      7,
    );
    const before = await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 });
    const analysisConditions = { sourceRevision: fileRevision, definition };
    const result = await service.read({ sourceId: 3, analysisConditions }, 8);
    expect(result.definition).toEqual(definition);
    expect(result.semantics).toBeUndefined();
    expect(result.columns.find(c => c.name === 'amount').businessType).toBeUndefined();
    expect(result.version).toBe(1);
    expect(result.sourceRevision).toBe(revision);
    const adopted = await service.read(
      { sourceId: 3, analysisConditions, adoptCurrentSemantics: true },
      8,
    );
    expect(adopted.definition).toEqual(definition);
    expect(adopted.semantics).toEqual(source.semantics);
    expect(adopted.columns.find(c => c.name === 'amount').businessType).toBe('category');
    expect(await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 })).toEqual(
      before,
    );
  });
  it('reads a frozen semantic analysis independently of a native SourceEntry and a different latest catalog', async () => {
    await service.save(request(), 7);
    await addCatalog(1, 'category');
    const snapshot = (await service.read({ sourceId: 3, adoptCurrentSemantics: true }, 8))
      .semantics;
    await addCatalog(2, 'number');
    const analysisConditions = {
      sourceRevision: fileRevision,
      definition: { include: { ...definition.include, operator: 'eq' }, exclude: null },
      semantics: snapshot,
    };
    const serialized = JSON.stringify(analysisConditions);
    const result = await service.read({ sourceId: 3, analysisConditions }, 8);
    expect(result.definition).toEqual(analysisConditions.definition);
    expect(result.semantics).toEqual(snapshot);
    expect(result.columns.find(c => c.name === 'amount').businessType).toBe('category');
    const adopted = await service.read(
      { sourceId: 3, analysisConditions, adoptCurrentSemantics: true },
      8,
    );
    expect(adopted.definition).toEqual(analysisConditions.definition);
    expect(adopted.semantics.catalogVersion).toBe(2);
    expect(adopted.columns.find(c => c.name === 'amount').businessType).toBe('number');
    expect(JSON.stringify(analysisConditions)).toBe(serialized);
    expect(
      (await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 })).semanticsJSON,
    ).toBeNull();
    expect(await db.manager.count(SourceConditionEntry)).toBe(1);
  });
  it.each(['definition', 'semantics JSON', 'missing history'])(
    'reads provided native analysis despite unrelated SourceEntry corruption: %s',
    async corruption => {
      await service.save(request(), 7);
      await db.manager.update(
        SourceConditionEntry,
        { sourceId: 3, version: 1 },
        corruption === 'definition'
          ? { definition: '{broken' }
          : {
              semanticsJSON:
                corruption === 'semantics JSON'
                  ? '{broken'
                  : JSON.stringify({ schemaVersion: 1, catalogVersion: 999, columns: [] }),
            },
      );
      const before = await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 });
      await expect(service.read({ sourceId: 3 }, 8)).rejects.toThrow();
      connection.queryDuckDB.mockClear();
      const result = await service.read(
        { sourceId: 3, analysisConditions: { sourceRevision: fileRevision, definition } },
        8,
      );
      expect(result.definition).toEqual(definition);
      expect(result.semantics).toBeUndefined();
      expect(result.version).toBe(1);
      expect(connection.queryDuckDB.mock.calls.every(call => call[1].startsWith('DESCRIBE'))).toBe(
        true,
      );
      expect(await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 })).toEqual(
        before,
      );
      expect(await db.manager.count(SourceConditionEntry)).toBe(1);
    },
  );
  it('resolves only provided frozen history when unrelated SourceEntry catalog history is corrupt', async () => {
    await addCatalog(1, 'category');
    const semantics = (await service.read({ sourceId: 3 }, 8)).semantics;
    await addCatalog(2);
    const unrelated = (await service.read({ sourceId: 3 }, 8)).semantics;
    await service.save({ ...request(), semantics: unrelated }, 7);
    await db.manager.update(
      SourceCatalogEntry,
      { sourceId: 3, version: 2 },
      { metadata: '{broken' },
    );
    const before = await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 });
    await expect(service.read({ sourceId: 3 }, 8)).rejects.toThrow();
    connection.queryDuckDB.mockClear();
    const analysisConditions = {
      sourceRevision: fileRevision,
      definition: { include: { ...definition.include, operator: 'eq' }, exclude: null },
      semantics,
    };
    const result = await service.read({ sourceId: 3, analysisConditions }, 8);
    expect(result.definition).toEqual(analysisConditions.definition);
    expect(result.semantics).toEqual(semantics);
    expect(result.columns.find(c => c.name === 'amount').businessType).toBe('category');
    expect(connection.queryDuckDB.mock.calls.every(call => call[1].startsWith('DESCRIBE'))).toBe(
      true,
    );
    expect(await db.manager.findOneBy(SourceConditionEntry, { sourceId: 3, version: 1 })).toEqual(
      before,
    );
    expect(await db.manager.count(SourceConditionEntry)).toBe(1);
  });
  it('treats SourceEntry version as informational for provided analysis, even when source conditions append concurrently', async () => {
    await service.save(request(), 7);
    const current = (service as any).current.bind(service);
    const spy = jest
      .spyOn(service as any, 'current')
      .mockImplementationOnce(async (...args: any[]) => {
        await db.manager.insert(SourceConditionEntry, {
          sourceId: 3,
          version: 2,
          actorId: 7,
          sourceRevision: revision,
          definition: JSON.stringify({ include: null, exclude: null }),
          semanticsJSON: null,
        });
        return current(...args);
      });
    try {
      const result = await service.read(
        { sourceId: 3, analysisConditions: { sourceRevision: fileRevision, definition } },
        8,
      );
      expect(result.definition).toEqual(definition);
      expect(result.version).toBe(1);
    } finally {
      spy.mockRestore();
    }
    expect(await db.manager.count(SourceConditionEntry)).toBe(2);
  });
  it('rejects stale/malformed/forged analysis wrappers without using SourceEntry as fallback', async () => {
    await addCatalog(1);
    const snapshot = (await service.read({ sourceId: 3 }, 8)).semantics;
    for (const analysisConditions of [
      null,
      { sourceRevision: 'metadata', definition },
      { sourceRevision: 'a'.repeat(64), definition },
      { sourceRevision: fileRevision, definition, semantics: { ...snapshot, catalogVersion: 999 } },
      { sourceRevision: fileRevision, definition, sql: 'SELECT private' },
    ]) {
      await expect(service.read({ sourceId: 3, analysisConditions }, 8)).rejects.toThrow();
    }
    expect(await db.manager.count(SourceConditionEntry)).toBe(0);
  });
  it('rechecks file/rights/catalog after preparing provided analysis context', async () => {
    await addCatalog(1);
    const analysisConditions = { sourceRevision: fileRevision, definition };
    const current = (service as any).current.bind(service);
    const spy = jest
      .spyOn(service as any, 'current')
      .mockImplementationOnce(async (...args: any[]) => {
        const result = await current(...args);
        await addCatalog(2);
        return result;
      });
    try {
      await expect(
        service.read({ sourceId: 3, analysisConditions, adoptCurrentSemantics: true }, 8),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      spy.mockRestore();
    }
    access.assert.mockRejectedValueOnce(new ForbiddenException());
    await expect(service.read({ sourceId: 3, analysisConditions }, 8)).rejects.toMatchObject({
      status: 403,
    });
    connection.duckDBVersion.mockResolvedValue('b'.repeat(64));
    await expect(service.read({ sourceId: 3, analysisConditions }, 8)).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.manager.count(SourceConditionEntry)).toBe(0);
  });
  it('UC055 refuses a history append when Source is deleted after SQL preparation', async () => {
    const current = (service as any).current.bind(service);
    jest.spyOn(service as any, 'current').mockImplementation(async (...args: any[]) => {
      const result = await current(...args);
      await db.manager.delete(Database, 3);
      return result;
    });
    await expect(service.save(request(), 7)).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.count(SourceConditionEntry)).toBe(0);
  });
  it('starts empty and never returns source rows or writes', async () => {
    const result = await service.read({ sourceId: 3 }, 7);
    expect(result).toMatchObject({
      sourceId: 3,
      version: 0,
      sourceRevision: revision,
      definition: { include: null, exclude: null },
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(0);
    expect(
      connection.queryDuckDB.mock.calls.filter(call => !call[1].startsWith('DESCRIBE')),
    ).toHaveLength(0);
  });
  it('previews bound conditions once with full-population ratios and no writes', async () => {
    const result = await service.preview(request(), 8);
    expect(result.draft).toEqual(request());
    expect(result.analysisConditions).toEqual({ sourceRevision: fileRevision, definition });
    expect(result.analysisConditions.sourceRevision).not.toBe(result.draft.sourceRevision);
    expect(result.population).toEqual({
      total: '10',
      matched: '4',
      excluded: '1',
      remaining: '3',
      matchedRatio: 0.4,
      remainingRatio: 0.3,
    });
    expect(connection.queryDuckDB.mock.calls.find(call => call[1].startsWith('WITH'))[2]).toEqual([
      10,
    ]);
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(0);
  });
  it('restores immutable attributed versions after restart and rejects stale CAS', async () => {
    expect((await service.save(request(), 7)).version).toBe(1);
    expect(
      (await new SourceConditionsService(db, access, connection).read({ sourceId: 3 }, 7))
        .definition,
    ).toEqual(definition);
    await expect(service.save(request(), 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceConditionEntry).find()).toMatchObject([
      { actorId: 7, version: 1, sourceRevision: revision },
    ]);
  });
  it('requires read before profiling and edit before writes', async () => {
    await expect(service.preview(request(), 9)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.save(request(), 8)).rejects.toBeInstanceOf(ForbiddenException);
    expect(connection.captureDuckDBSnapshot).not.toHaveBeenCalled();

    expect(await db.getRepository(SourceConditionEntry).count()).toBe(0);
  });
  it('rejects malformed types, unknown fields and stale source with no writes', async () => {
    for (const body of [
      { ...request(), extra: 'sql' },
      { ...request(), sourceRevision: 'old' },
      {
        ...request(),
        definition: { include: { ...definition.include, values: ['10'] }, exclude: null },
      },
    ])
      await expect(service.save(body, 7)).rejects.toThrow();
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(0);
  });
  it('rejects a source replacement after pinned execution', async () => {
    connection.queryDuckDB
      .mockImplementationOnce(async () => ({
        datas: [{ column_name: 'amount', column_type: 'DOUBLE' }],
      }))
      .mockImplementationOnce(async () => {
        connection.duckDBVersion.mockResolvedValue('file-v2');
        return { datas: [{ total: '1', matched: '1', excluded: '0', remaining: '1' }] };
      });
    await expect(service.preview(request(), 7)).rejects.toMatchObject({ status: 409 });
  });
  it('rejects counts when another condition version commits during execution', async () => {
    connection.queryDuckDB
      .mockImplementationOnce(async () => ({
        datas: [{ column_name: 'amount', column_type: 'DOUBLE' }],
      }))
      .mockImplementationOnce(async () => {
        const entries = db.getRepository(SourceConditionEntry);
        await entries.insert({
          sourceId: 3,
          version: 1,
          actorId: 7,
          sourceRevision: revision,
          definition: JSON.stringify({ include: null, exclude: null }),
        });
        return { datas: [{ total: '1', matched: '1', excluded: '0', remaining: '1' }] };
      });
    await expect(service.preview(request(), 7)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
  });

  it('rechecks read authority after execution', async () => {
    connection.queryDuckDB
      .mockImplementationOnce(async () => ({
        datas: [{ column_name: 'amount', column_type: 'DOUBLE' }],
      }))
      .mockImplementationOnce(async () => {
        access.assert.mockRejectedValue(new ForbiddenException());
        return { datas: [{ total: '1', matched: '1', excluded: '0', remaining: '1' }] };
      });
    await expect(service.preview(request(), 7)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('derives analysis conditions inside the captured file pin, retaining the metadata draft revision', async () => {
    let insidePin = false;
    connection.captureDuckDBSnapshot.mockImplementation(async () => ({
      run: async operation => {
        const previous = insidePin;
        insidePin = true;
        try {
          return await operation();
        } finally {
          insidePin = previous;
        }
      },
    }));
    connection.duckDBVersion.mockImplementation(async () =>
      insidePin ? fileRevision : 'a'.repeat(64),
    );
    const before = await db.manager.findOneBy(Database, { id: 3 });
    const result = await service.preview(request(), 8);
    expect(result.analysisConditions).toEqual({ sourceRevision: fileRevision, definition });
    expect(result.draft.sourceRevision).toBe(revision);
    expect(await db.manager.findOneBy(Database, { id: 3 })).toEqual(before);
    expect(await db.manager.count(SourceConditionEntry)).toBe(0);
  });
  it('returns null ratios for empty full population', async () => {
    connection.queryDuckDB.mockImplementation(async (_id, sql) =>
      sql.startsWith('DESCRIBE')
        ? { datas: [{ column_name: 'amount', column_type: 'DOUBLE' }] }
        : { datas: [{ total: '0', matched: '0', excluded: '0', remaining: '0' }] },
    );
    expect((await service.preview(request(), 7)).population).toMatchObject({
      matchedRatio: null,
      remainingRatio: null,
    });
  });
  it('appends only one winner for concurrent same-version saves', async () => {
    const results = await Promise.allSettled([
      service.save(request(), 7),
      service.save(request(), 7),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
  });
  it('fails closed for damaged stored definitions', async () => {
    await service.save(request(), 7);
    await db
      .getRepository(SourceConditionEntry)
      .update({ sourceId: 3, version: 1 }, { definition: '{broken' });
    await expect(service.read({ sourceId: 3 }, 7)).rejects.toMatchObject({ status: 409 });
    await expect(service.preview({ ...request(), version: 1 }, 7)).rejects.toMatchObject({
      status: 409,
    });
    await expect(service.save({ ...request(), version: 1 }, 7)).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.getRepository(SourceConditionEntry).count()).toBe(1);
  });
});
