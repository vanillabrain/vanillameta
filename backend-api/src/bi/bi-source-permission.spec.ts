import { SourceLifecycleService } from '../enterprise/source-lifecycle.service';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

import { ForbiddenException } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { ConnectionService } from '../connection/connection.service';
import { Database } from '../database/entities/database.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { Metric } from '../metric/entities/metric.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { User } from '../user/entities/user.entity';
import { BiExploreService } from './bi-explore.service';
import { BiService } from './bi.service';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
import { SourceCatalogService } from './source-catalog.service';

/** Source owner, same-organization recipient and an unrelated-organization account. */
const OWNER = 10;
const GRANTEE = 20;
const OUTSIDER = 30;

/**
 * UC051 source grants, proven against the real SQLite policy tables (membership + grant) and a
 * real DuckDB file. These tests are about the boundary, not the happy path: a read grant must
 * open Explore reads without also opening export, metric writes, metadata writes or the creation
 * of a new dashboard from someone else's source.
 */
describe('UC051 source grants across Explore, catalog and export', () => {
  /**
   * Nine rows with a deliberate NULL region. Independent oracles used below:
   * SUM(amount) = 12+18+36+20+40+50+60+70+5 = 311; region 'A' = 12+18+20+70 = 120.
   */
  const mainRows: Array<Array<string | number | null>> = [
    ['A', 'web', 12, 2, '2026-01-01'],
    ['A', 'web', 18, 4, '2026-01-01'],
    [null, 'web', 36, 6, '2026-01-01'],
    ['A', 'app', 20, 0, '2026-01-02'],
    ['B', 'app', 40, 5, '2026-01-02'],
    ['B', 'app', 50, 3, '2026-01-03'],
    ['C', 'app', 60, 1, '2026-01-03'],
    ['A', 'app', 70, 2, '2026-01-04'],
    ['D', 'bulk', 5, 0, '2026-01-04'],
  ];
  const literal = (value: string | number | null) =>
    value === null ? 'NULL' : typeof value === 'number' ? String(value) : "'" + value + "'";
  const mainSql =
    'CREATE TABLE uploaded_data AS SELECT ' +
    'CAST("column0" AS VARCHAR) AS region, CAST("column1" AS VARCHAR) AS channel, ' +
    'CAST("column2" AS DOUBLE) AS amount, CAST("column3" AS DOUBLE) AS weight, ' +
    'CAST("column4" AS DATE) AS day FROM (VALUES ' +
    mainRows.map(values => '(' + values.map(literal).join(', ') + ')').join(', ') +
    ') t(column0, column1, column2, column3, column4)';

  const metricDefinition = JSON.stringify({
    schemaVersion: 1,
    definitionVersion: 1,
    sourceId: 1,
    tableName: 'uploaded_data',
    label: 'Revenue',
    aggregation: 'SUM',
    column: 'amount',
    unit: '',
    decimalPlaces: 0,
    numberNotation: 'plain',
  });
  const metricBody = () => ({
    sourceId: 1,
    label: 'Revenue',
    aggregation: 'SUM',
    column: 'amount',
    unit: '$',
    decimalPlaces: 2,
    numberNotation: 'plain',
  });

  const previousRoot = process.env.FILE_UPLOAD_DIR;
  let root: string;
  let worker: DuckDBService;
  let sourceFile: string;
  let db: DataSource;
  let policy: EnterpriseResourcePolicyService;
  let bi: BiService;
  let explore: BiExploreService;
  let catalog: SourceCatalogService;
  let saveDashboard: jest.Mock;

  const writeSource = async (sql: string) => {
    const directory = path.join(root, randomUUID());
    fs.mkdirSync(directory, { recursive: true });
    const filename = path.join(directory, 'data.duckdb');
    const instance = await DuckDBInstance.create(filename, { access_mode: 'READ_WRITE' });
    const connection = await instance.connect();
    await connection.run(sql);
    await connection.run('CHECKPOINT');
    connection.closeSync();
    instance.closeSync();
    return filename;
  };

  /** The grant row is the only thing that makes a foreign source readable; version stays at 1. */
  const grant = (rights: Partial<Record<'read' | 'edit' | 'publish' | 'export', boolean>> = {}) =>
    db.getRepository(EnterpriseResourceGrant).save({
      resourceKind: 'source',
      resourceId: 1,
      recipientId: GRANTEE,
      organizationId: 1,
      ownerId: OWNER,
      version: 1,
      read: true,
      edit: false,
      publish: false,
      export: false,
      ...rights,
    });

  const revisionFor = async (actor: number) =>
    (await explore.catalog({ sourceId: 1 }, actor)).sourceRevision;
  const exploreQuery = (sourceRevision: string) => ({
    sourceId: 1,
    sourceRevision,
    measureIds: [1],
    rankingMeasureId: 1,
    dimensionColumns: ['region'],
    filters: [],
    trendGrain: 'auto',
    comparePrevious: false,
    includeRows: false,
  });

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-bi-source-grant-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    sourceFile = await writeSource(mainSql);
  });

  afterAll(async () => {
    await worker?.onModuleDestroy();
    if (root) fs.rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });

  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [
        Database,
        Metric,
        SourceCatalogEntry,
        User,
        EnterpriseMembership,
        EnterpriseResourceGrant,
        EnterpriseAuditEvent,
      ],
      synchronize: true,
    }).initialize();
    await db.getRepository(User).save(
      [OWNER, GRANTEE, OUTSIDER].map(id => ({
        id,
        userId: 'account-' + id,
        email: 'account-' + id + '@example.invalid',
        password: 'hash-' + id,
        active: true,
        authVersion: 0,
      })),
    );
    await db.getRepository(EnterpriseMembership).save([
      { userId: OWNER, organizationId: 1, role: 'admin' as const, team: '' },
      { userId: GRANTEE, organizationId: 1, role: 'member' as const, team: '' },
      { userId: OUTSIDER, organizationId: 2, role: 'admin' as const, team: '' },
    ]);
    await db.getRepository(Database).save([
      {
        id: 1,
        name: 'Owner source',
        engine: 'duckdb',
        type: 'file',
        ownerId: OWNER,
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: sourceFile },
        }),
      },
      {
        id: 2,
        name: 'Grantee source',
        engine: 'duckdb',
        type: 'file',
        ownerId: GRANTEE,
        connectionConfig: JSON.stringify({
          client: 'duckdb',
          connection: { filename: sourceFile },
        }),
      },
    ]);
    await db.getRepository(Metric).save({
      id: 1,
      name: 'bi_revenue',
      databaseId: 1,
      tableName: 'uploaded_data',
      aggregation: 'SUM' as any,
      expression: 'amount',
      description: 'Revenue',
      definition: metricDefinition,
      useYn: 'Y',
    });
    policy = new EnterpriseResourcePolicyService(db);
    const access = new SourceAccessService(db, policy);
    const connection = new ConnectionService(db.getRepository(Database), {} as any, worker);
    saveDashboard = jest.fn(async () => ({ data: { id: 42 } }));
    bi = new BiService(db, access, connection, { save: saveDashboard } as any);
    explore = new BiExploreService(
      bi,
      new AiDashboardService({} as any, connection, {} as any),
      connection,
    );
    catalog = new SourceCatalogService(db, access, bi);
  });

  afterEach(async () => await db?.destroy());

  it('resolves capabilities and ownership per request instead of caching one actor rights', async () => {
    await grant();
    const ownerBefore = await bi.profile(1, OWNER);
    expect(ownerBefore.access).toEqual({ read: true, edit: true, publish: false, export: true });
    expect(ownerBefore.owned).toBe(true);
    const shared = await bi.profile(1, GRANTEE);
    expect(shared.access).toEqual({ read: true, edit: false, publish: false, export: false });
    expect(shared.owned).toBe(false);
    // The same snapshot cache entry is reused, but the rights are resolved for the new actor.
    const ownerAfter = await bi.profile(1, OWNER);
    expect(ownerAfter.access).toEqual({ read: true, edit: true, publish: false, export: true });
    expect(ownerAfter.owned).toBe(true);
  });

  it('lists own plus granted sources per current grant and never another organization', async () => {
    await grant();
    expect(await bi.sources(GRANTEE)).toEqual([
      { id: 1, name: 'Owner source', engine: 'duckdb' },
      { id: 2, name: 'Grantee source', engine: 'duckdb' },
    ]);
    expect((await bi.sources(GRANTEE, true)).map(source => source.id)).toEqual([1, 2]);
    expect(await bi.sources(OWNER)).toEqual([{ id: 1, name: 'Owner source', engine: 'duckdb' }]);
    expect((await bi.sources(OWNER, true)).map(source => source.id)).toEqual([1]);
    // No grant and no membership in the owner's organization.
    expect(await bi.sources(OUTSIDER)).toEqual([]);
    expect(await bi.sources(OUTSIDER, true)).toEqual([]);
  });

  it('attaches per-actor capabilities to the Explore catalog and reads real numbers', async () => {
    await grant();
    const sharedCatalog = await explore.catalog({ sourceId: 1 }, GRANTEE);
    expect(sharedCatalog.access).toEqual({
      read: true,
      edit: false,
      publish: false,
      export: false,
    });
    expect(sharedCatalog.owned).toBe(false);
    const ownCatalog = await explore.catalog({ sourceId: 1 }, OWNER);
    expect(ownCatalog.access).toEqual({
      read: true,
      edit: true,
      publish: false,
      export: true,
    });
    expect(ownCatalog.owned).toBe(true);
    // The per-actor fields stay out of the view revision, so a grant change cannot invalidate a
    // stored Explore view snapshot.
    expect(sharedCatalog.viewRevision).toBe(ownCatalog.viewRevision);
    const result: any = await explore.query(exploreQuery(await revisionFor(GRANTEE)), GRANTEE);
    expect(result.kpis[0]).toMatchObject({ id: 1, title: 'Revenue', value: 311 });
    expect(result.leaderboards[0].rows.find((entry: any) => entry.category === 'A')).toEqual({
      category: 'A',
      value: 120,
    });
  });

  it('requires the separate export right and denies it again after a CAS revocation', async () => {
    await grant();
    const query = exploreQuery(await revisionFor(GRANTEE));
    await expect(explore.exportCsv({ mode: 'explore', query }, GRANTEE)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    // The export right is checked before the query contract: an incomplete query still returns
    // 403 for a grantee that may read, which proves the guard precedes query validation.
    await expect(
      explore.exportCsv({ mode: 'explore', query: { sourceId: 1 } }, GRANTEE),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // Owner control: the same payload still exports for the source owner.
    const ownerExport: any = await explore.exportCsv({ mode: 'explore', query }, OWNER);
    expect(ownerExport.filename).toBe('bi-explore-1.csv');
    await grant({ export: true });
    const grantedExport: any = await explore.exportCsv({ mode: 'explore', query }, GRANTEE);
    expect(grantedExport.filename).toBe('bi-explore-1.csv');
    expect(grantedExport.rowCount).toBeGreaterThan(0);
    // A versioned tombstone written through the real policy CAS closes every path again.
    const revoked = await policy.set('source', 1, OWNER, {
      recipientId: GRANTEE,
      expectedVersion: 1,
      rights: { read: false, edit: false, publish: false, export: false },
    });
    expect(revoked).toMatchObject({ resourceId: 1, recipientId: GRANTEE, version: 2 });
    await expect(explore.exportCsv({ mode: 'explore', query }, GRANTEE)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(explore.catalog({ sourceId: 1 }, GRANTEE)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await bi.sources(GRANTEE)).toEqual([
      { id: 2, name: 'Grantee source', engine: 'duckdb' },
    ]);
  });

  it('needs edit for metric creation and keeps a read grant read-only without writes', async () => {
    await grant();
    await expect(bi.createMetric(metricBody(), GRANTEE)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await db.getRepository(Metric).count()).toBe(1);
    await grant({ edit: true });
    const created = await bi.createMetric(metricBody(), GRANTEE);
    expect(created).toMatchObject({ label: 'Revenue', definitionVersion: 1 });
    const stored = await db.getRepository(Metric).findOneByOrFail({ id: created.id });
    expect(stored.databaseId).toBe(1);
    expect(await db.getRepository(Metric).count()).toBe(2);
  });

  it('needs edit for catalog preview/save while catalog read and history stay read', async () => {
    await grant();
    const read = await catalog.read({ sourceId: 1 }, GRANTEE);
    expect(read).toMatchObject({ sourceId: 1, version: 0 });
    const draft = {
      sourceId: 1,
      sourceRevision: read.sourceRevision,
      version: read.version,
      label: '업무 설명',
      description: '',
      columns: read.columns.map((column: any) => ({
        column: column.column,
        label: column.column,
        description: '',
        unit: '',
      })),
    };
    await expect(catalog.preview(draft, GRANTEE)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(catalog.save(draft, GRANTEE)).rejects.toBeInstanceOf(ForbiddenException);
    expect(await db.getRepository(SourceCatalogEntry).count()).toBe(0);
    expect(await catalog.history({ sourceId: 1 }, GRANTEE)).toEqual({
      sourceId: 1,
      entries: [],
      nextBeforeVersion: null,
    });
    await grant({ edit: true });
    const preview = await catalog.preview(draft, GRANTEE);
    expect(preview.draft).toMatchObject({ sourceId: 1, label: '업무 설명' });
  });

  it('keeps new-dashboard creation source-owner only even for an edit grant', async () => {
    await grant({ edit: true });
    const body = { sourceId: 1, metricId: 1, title: 'Revenue', chart: 'number' };
    saveDashboard.mockClear();
    await expect(bi.save(body, GRANTEE)).rejects.toBeInstanceOf(ForbiddenException);
    expect(saveDashboard).not.toHaveBeenCalled();
    await expect(bi.save(body, OWNER)).resolves.toEqual({ id: 42 });
    expect(saveDashboard).toHaveBeenCalledTimes(1);
  });
  it('blocks cached profile, catalog, query, CSV and creation on inactive source and restores unchanged data', async () => {
    await grant({ read: true, edit: true, export: true });
    const before = await bi.profile(1, GRANTEE);
    const selected = await explore.catalog({ sourceId: 1 }, GRANTEE);
    const lifecycle = new SourceLifecycleService(db, policy);
    const grants = await db.getRepository(EnterpriseResourceGrant).find();
    const sourceQueries = jest.spyOn((bi as any).connection, 'queryDuckDB');
    sourceQueries.mockClear();
    await lifecycle.set(1, OWNER, { expectedVersion: 0, active: false });
    for (const actor of [OWNER, GRANTEE]) {
      await expect(bi.profile(1, actor)).rejects.toMatchObject({ status: 403 });
      await expect(catalog.read({ sourceId: 1 }, actor)).rejects.toMatchObject({ status: 403 });
      await expect(explore.catalog({ sourceId: 1 }, actor)).rejects.toMatchObject({ status: 403 });
      await expect(
        explore.query(exploreQuery(selected.sourceRevision), actor),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        explore.exportCsv({ mode: 'explore', query: exploreQuery(selected.sourceRevision) }, actor),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        bi.save({ sourceId: 1, metricId: 1, title: 'blocked', chart: 'number' }, actor),
      ).rejects.toMatchObject({ status: 403 });
    }
    expect(sourceQueries).not.toHaveBeenCalled();
    expect((await bi.sources(GRANTEE)).map(s => s.id)).not.toContain(1);
    expect((await bi.sources(GRANTEE, true)).map(s => s.id)).not.toContain(1);
    expect(await lifecycle.read(1, OWNER)).toEqual({ sourceId: 1, active: false, version: 1 });
    await lifecycle.set(1, OWNER, { expectedVersion: 1, active: true });
    expect((await bi.profile(1, GRANTEE)).rowCount).toBe(before.rowCount);
    expect(await db.getRepository(EnterpriseResourceGrant).find()).toEqual(grants);
    expect(
      (
        await explore.query(
          exploreQuery((await explore.catalog({ sourceId: 1 }, GRANTEE)).sourceRevision),
          GRANTEE,
        )
      ).kpis[0],
    ).toMatchObject({ id: 1, value: 311 });
  });
});
