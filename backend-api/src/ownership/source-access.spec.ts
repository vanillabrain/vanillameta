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
  it('checks the saved-metric catalog source for owner, foreign and legacy access', async () => {
    await expect(
      guard.canActivate(
        request('AiController', 'dashboardMetrics', { method: 'GET', params: { id: '2' } }),
      ),
    ).resolves.toBe(true);
    for (const id of ['1', '3']) {
      await expect(
        guard.canActivate(
          request('AiController', 'dashboardMetrics', { method: 'GET', params: { id } }),
        ),
      ).rejects.toThrow(ForbiddenException);
    }
  });
  it.each([
    'metricChangePreview',
    'metricChangeSave',
    'metricImpact',
    'metricBatchPreview',
    'metricBatchSave',
  ])('checks both source-linked metric and analysis owners for %s', async handler => {
    await expect(
      guard.canActivate(
        request('AiController', handler, {
          body: { dashboardId: 51, metricId: 21 },
          user: { accessKeyData: { id: 7 } },
        }),
      ),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(
        request('AiController', handler, { body: { dashboardId: 51, metricId: 21 } }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
  beforeEach(() => {
    const db: any = {
      options: { type: 'sqlite' },
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
  it('guards the saved view as dashboard read without trusting a submitted source', async () => {
    const read = jest.spyOn(access, 'dashboard').mockResolvedValue(undefined);
    await expect(
      guard.canActivate(request('AiController', 'dashboardView', { body: { dashboardId: 51 } })),
    ).resolves.toBe(true);
    expect(read).toHaveBeenCalledWith(51, 8, 'read');
  });
  it('rejects a saved view without a valid dashboard ID', async () => {
    await expect(
      guard.canActivate(
        request('AiController', 'dashboardView', { body: { draft: { databaseId: 1 } } }),
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
  it('dashboardDetails requires explicit read access to both the draft source and dashboard', async () => {
    const source = jest.spyOn(access, 'assert');
    const dashboard = jest.spyOn(access, 'dashboard');
    await expect(
      guard.canActivate(
        request('AiController', 'dashboardDetails', {
          body: { dashboardId: 51, draft: { databaseId: 1 } },
          user: { accessKeyData: { id: 7 } },
        }),
      ),
    ).resolves.toBe(true);
    expect(source).toHaveBeenCalledWith('database', 1, 7, 'read');
    expect(dashboard).toHaveBeenCalledWith(51, 7, 'read');
  });
  it.each([undefined, null, false, 0, -1, 1.5, 'invalid', '0', Number.MAX_SAFE_INTEGER + 1])(
    'dashboardDetails rejects missing or invalid dashboardId %p even with a valid draft and decoy URL ID',
    async dashboardId => {
      await expect(
        guard.canActivate(
          request('AiController', 'dashboardDetails', {
            params: { id: '51' },
            body: { dashboardId, draft: { databaseId: 1 } },
            user: { accessKeyData: { id: 7 } },
          }),
        ),
      ).rejects.toThrow();
    },
  );
  it.each([
    { dashboardId: 51, draft: { databaseId: 2 } },
    { dashboardId: 51, draft: { databaseId: 3 } },
    { dashboardId: 51, draft: {} },
    { dashboardId: 51 },
    { dashboardId: 999, draft: { databaseId: 1 } },
  ])('dashboardDetails rejects inaccessible or missing source/dashboard %j', async body => {
    await expect(
      guard.canActivate(
        request('AiController', 'dashboardDetails', {
          body,
          user: { accessKeyData: { id: 7 } },
        }),
      ),
    ).rejects.toThrow();
  });
  it('dashboardDetails denies a non-owner dashboard even when the draft source belongs to that actor', async () => {
    await expect(
      guard.canActivate(
        request('AiController', 'dashboardDetails', {
          body: { dashboardId: 51, draft: { databaseId: 2 } },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('dashboardDetails denies shared tokens before reading raw source rows', async () => {
    const source = jest.spyOn(access, 'assert');
    await expect(
      guard.canActivate(
        request('AiController', 'dashboardDetails', {
          body: { dashboardId: 51, draft: { databaseId: 1 } },
          user: { shareKeyData: { dashboardId: 51 } },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(source).not.toHaveBeenCalled();
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
  it.each(['listViews', 'createView', 'loadView', 'removeView'])(
    'uses dashboard read for personal view handler %s',
    async handler => {
      const authorization = jest.spyOn(access, 'dashboard');
      await expect(
        guard.canActivate(
          request('DashboardController', handler, {
            params: { id: '51' },
            user: { accessKeyData: { id: 7 } },
          }),
        ),
      ).resolves.toBe(true);
      expect(authorization).toHaveBeenCalledWith('51', 7, 'read');
    },
  );
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
