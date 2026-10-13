import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SourceAccessService } from './source-access.service';
import { SourceOwnershipGuard } from './source-ownership.guard';
import { AddSourceOwner1791850000000 } from '../migrations/1791850000000-add-source-owner';

describe('source ownership boundary', () => {
  let access: SourceAccessService;
  let guard: SourceOwnershipGuard;
  const rows: any = {
    Database: [
      { id: 1, ownerId: 7, engine: 'duckdb' },
      { id: 2, ownerId: 8, engine: 'duckdb' },
      { id: 3, ownerId: null },
    ],
    Dataset: [
      { id: 11, databaseId: 1 },
      { id: 12, databaseId: 2 },
    ],
    Metric: [{ id: 21, databaseId: 1, name: 'private' }],
    TableQuery: [{ id: 31, databaseId: 1 }],
    Widget: [{ id: 41, datasetType: 'DATASET', datasetId: 11 }],
    Dashboard: [{ id: 51, delYn: 'N' }],
    DashboardWidget: [{ dashboardId: 51, widgetId: 41 }],
    UserMapping: [{ dashboardId: 51, userInfoId: 7 }],
  };
  beforeEach(() => {
    const db: any = {
      getRepository: entity => ({
        findOne: async ({ where }) =>
          rows[entity.name].find(row =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          ),
        find: async ({ where }) =>
          rows[entity.name].filter(row =>
            Object.entries(where).every(([key, value]) => row[key] === value),
          ),
      }),
    };
    access = new SourceAccessService(db);
    guard = new SourceOwnershipGuard(access);
  });
  const request = (group: string, method: string, extras: any = {}) => {
    const handler = () => undefined;
    Object.defineProperty(handler, 'name', { value: method });
    return {
      getClass: () => ({ name: group }),
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { accessKeyData: { id: 8 } },
          params: {},
          query: {},
          body: {},
          method: 'POST',
          ...extras,
        }),
      }),
    } as any;
  };
  it.each(['database', 'dataset', 'metric', 'table', 'widget'] as const)(
    'permits owner and denies foreign %s lineage',
    async kind => {
      const ids = { database: 1, dataset: 11, metric: 21, table: 31, widget: 41 };
      await expect(access.assert(kind, ids[kind], 7)).resolves.toBeUndefined();
      await expect(access.assert(kind, ids[kind], 8)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
  it.each(['fileVersions', 'replaceFile', 'restoreFile'])(
    'protects file version handler %s before upload',
    async handler => {
      await expect(
        guard.canActivate(request('DatabaseController', handler, { params: { id: '1' } })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        guard.canActivate(request('DatabaseController', handler, { params: { id: '2' } })),
      ).resolves.toBe(true);
    },
  );
  it.each(['fileVersions', 'replaceFile', 'restoreFile'])(
    'rejects share tokens for file version handler %s',
    async handler => {
      await expect(
        guard.canActivate(
          request('DatabaseController', handler, {
            params: { id: '2' },
            user: { shareKeyData: { dashboardId: 51 } },
            method: 'GET',
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
  it('locks NULL owners and hides foreign list entries', async () => {
    await expect(access.assert('database', 3, 7)).rejects.toThrow();
    expect(await access.filterResults('database', 8, { data: rows.Database })).toEqual({
      data: [rows.Database[1]],
    });
  });
  it('rejects decoy source IDs, overwritten IDs, foreign metric names, and layouts', async () => {
    await expect(
      guard.canActivate(
        request('DatabaseController', 'findData', {
          method: 'GET',
          query: { databaseId: 2, datasetType: 'DATASET', datasetId: 11 },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      guard.canActivate(
        request('MetricController', 'create', { body: { databaseId: 2, name: 'private' } }),
      ),
    ).rejects.toThrow();
    await expect(
      guard.canActivate(
        request('DatasetController', 'create', { body: { databaseId: 2, id: 11 } }),
      ),
    ).rejects.toThrow();
    await expect(
      guard.canActivate(
        request('DashboardController', 'create', { body: { layout: [{ i: '41' }] } }),
      ),
    ).rejects.toThrow();
  });
  it('rejects file connection aliases on create, probe and update', async () => {
    for (const method of ['create', 'testConnection', 'update'])
      await expect(
        guard.canActivate(
          request('DatabaseController', method, {
            params: { id: 2 },
            body: { engine: 'duckdb', connectionConfig: { filename: '/foreign/data.duckdb' } },
          }),
        ),
      ).rejects.toThrow();
  });
  it('checks actual datasets and AI draft sources', async () => {
    await expect(
      guard.canActivate(
        request('AiController', 'recommendChart', {
          body: { databaseId: 2, datasetType: 'DATASET', datasetId: 11 },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      guard.canActivate(
        request('AiController', 'dashboardPreview', { body: { draft: { databaseId: 1 } } }),
      ),
    ).rejects.toThrow();
  });
  it('permits linked owner data for shares but rejects foreign data', async () => {
    expect(await access.sharedDashboard(51)).toBe(7);
    await expect(
      guard.canActivate(
        request('DatabaseController', 'findData', {
          method: 'GET',
          user: { shareKeyData: { dashboardId: 51 } },
          query: { datasetType: 'DATASET', datasetId: 11 },
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(
        request('DatabaseController', 'findData', {
          method: 'GET',
          user: { shareKeyData: { dashboardId: 51 } },
          query: { datasetType: 'DATASET', datasetId: 12 },
        }),
      ),
    ).rejects.toThrow();
  });
});
it('migration preserves legacy NULL owners, is repeatable, and supports fresh installation', async () => {
  const db = await new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [],
  }).initialize();
  const runner = db.createQueryRunner();
  const migration = new AddSourceOwner1791850000000();
  try {
    await migration.up(runner);
    await db.query('CREATE TABLE "database" (id INTEGER PRIMARY KEY, name TEXT)');
    await db.query('INSERT INTO "database" VALUES (1, ?)', ['legacy']);
    await migration.up(runner);
    await migration.up(runner);
    expect(await db.query('SELECT * FROM "database"')).toEqual([
      { id: 1, name: 'legacy', ownerId: null },
    ]);
  } finally {
    await runner.release();
    await db.destroy();
  }
});
