import { DashboardRevision } from '../dashboard-studio/entities/dashboard-revision.entity';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import {
  StudioPublication,
  StudioPublicationRequest,
} from '../dashboard-studio/entities/studio-publication.entity';
import { User } from '../user/entities/user.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { DuckDBService } from '../analysis/duckdb.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Metric } from '../metric/entities/metric.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioRun } from '../dashboard-studio/entities/studio-run.entity';
import { StudioService } from '../dashboard-studio/studio.service';
import { SourceAccessService } from '../ownership/source-access.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DashboardToolException } from './mcp-dashboard.errors';
import { ActorWindowLimiter } from './mcp-dashboard.limits';
import { McpDashboardService } from './mcp-dashboard.service';
import type { McpOAuthPrincipal } from './mcp-oauth.service';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
const draft = () => ({
  databaseId: 1,
  title: 'Studio actual',
  explanation: 'All time',
  widgets: [
    {
      title: 'Revenue',
      description: '',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
      decimalPlaces: 0,
    },
    {
      title: 'Channels',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT category,sum(amount) AS value FROM source GROUP BY category',
      categoryField: 'category',
      valueField: 'value',
      decimalPlaces: 0,
    },
  ],
});
jest.mock('ai', () => ({ generateText: jest.fn(), streamText: jest.fn(), tool: jest.fn() }));
jest.mock('@ai-sdk/provider', () => ({}));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));

const principal = (over: Partial<McpOAuthPrincipal> = {}): McpOAuthPrincipal => ({
  actorId: 7,
  authVersion: 0,
  grantId: 'grant-1',
  organizationId: 1,
  clientName: 'Synthetic AI',
  scopes: ['dashboards:read', 'dashboards:write'],
  ...over,
});
const rid = (n: number) => `5f0d3a6e-8c57-4a2b-9d51-${String(n).padStart(12, '0')}`;

describe('McpDashboardService.update on a real Studio', () => {
  let db: DataSource,
    worker: DuckDBService,
    ai: AiDashboardService,
    studio: StudioService,
    service: McpDashboardService,
    root: string,
    id: number,
    sourceRevision: string,
    n = 0;
  const auth = { revalidate: jest.fn(), assertGrant: jest.fn() };
  const previous = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-update-'));
    process.env.FILE_UPLOAD_DIR = root;
    worker = new DuckDBService();
    const file = await worker.importFile({
      originalname: 'studio.csv',
      buffer: Buffer.from(
        'category,amount,event_time\nSite,300,2026-01-01T00:00:00Z\nMobile,200,2026-01-02T00:00:00Z\n',
      ),
    });
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        SourceCatalogEntry,
        Dashboard,
        DashboardRevision,
        DashboardShare,
        DashboardWidget,
        UserMapping,
        Database,
        Dataset,
        Widget,
        Component,
        Metric,
        StudioState,
        StudioRun,
        User,
        EnterpriseOrganization,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
        StudioPublication,
        StudioPublicationRequest,
      ],
    }).initialize();
    sourceRevision = createHash('sha256').update(file.filename).digest('hex');
    await db.manager.save(Database, {
      id: 1,
      ownerId: 7,
      name: 'Source',
      connectionConfig: JSON.stringify({
        client: 'duckdb',
        connection: { filename: file.filename },
      }),
      engine: 'duckdb',
      type: 'FILE',
    });
    for (const type of ['BOARD_NUMERIC', 'CHART_COLUMN'])
      await db.manager.save(Component, { type, title: type, option: '{}', useYn: 'Y' });
    await db.manager.save(
      User,
      [7, 8].map(userId => ({
        id: userId,
        userId: `account-${userId}`,
        email: `account-${userId}@example.invalid`,
        password: 'x',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.save(EnterpriseOrganization, { id: 1, name: 'Org', version: 1 });
    await db.manager.save(EnterpriseMembership, [
      { userId: 7, organizationId: 1, role: 'contributor', team: '' },
      { userId: 8, organizationId: 1, role: 'editor', team: '' },
    ]);
    const connection: any = {
      withDuckDBSnapshot: jest.fn((_id, cb) => cb()),
      captureDuckDBSnapshot: jest.fn(async () => ({ run: async cb => cb() })),
      duckDBVersion: jest.fn().mockResolvedValue(sourceRevision),
      isDuckDB: jest.fn().mockResolvedValue(true),
      queryDuckDB: jest.fn((_id, sql, bindings) => worker.query(file.filename, sql, bindings)),
    };
    ai = new AiDashboardService({} as any, connection, db.getRepository(Dashboard));
    studio = new StudioService(db, ai, connection, new SourceAccessService(db));
    service = new McpDashboardService(
      db,
      new EnterpriseResourcePolicyService(db),
      studio,
      {} as never,
      auth as never,
    );
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previous;
  });
  beforeEach(async () => {
    auth.revalidate.mockReset().mockResolvedValue(undefined);
    auth.assertGrant.mockReset().mockResolvedValue(undefined);
    service.limiter = new ActorWindowLimiter();
    id = (await ai.save({ draft: draft() }, 7)).data.id;
  });

  const state = () => studio.readDocument(id, 7);
  const update = async (changes: unknown[], over: Record<string, unknown> = {}) => {
    const current = await state();
    return service.update(principal(), {
      dashboardId: id,
      requestId: rid(++n),
      expectedRevision: current.document.revision,
      expectedSourceRevision: current.sourceRevision,
      changes,
      ...over,
    });
  };
  const failure = (promise: Promise<unknown>) =>
    promise.then(
      () => null,
      (error: any) =>
        error instanceof DashboardToolException
          ? { code: error.code, reason: error.reason }
          : { other: error?.constructor?.name, message: error?.message },
    );
  const counts = async () => [
    await db.manager.count(Widget),
    await db.manager.count(StudioRun),
    await db.manager.count(DashboardRevision),
  ];

  it('renames, moves and resizes as the connection, and keeps the state it replaced', async () => {
    const before = await state();
    const [first] = before.document.blocks;
    const result = await update([
      { type: 'renameDashboard', title: 'Renamed by AI' },
      {
        type: 'updateBlock',
        blockId: first.id,
        patch: { title: 'Total', display: { prefix: '$' } },
      },
      { type: 'moveBlock', blockId: first.id, breakpoint: 'lg', x: 6, y: 20 },
      { type: 'resizeBlock', blockId: first.id, breakpoint: 'lg', w: 3, h: 3 },
    ]);
    const after = await state();
    expect(result).toEqual({ dashboardId: id, revision: after.document.revision, changed: true });
    expect(after.document.revision).not.toBe(before.document.revision);
    expect(after.document.title).toBe('Renamed by AI');
    expect(after.document.blocks[0]).toMatchObject({ title: 'Total', display: { prefix: '$' } });
    expect(after.document.layouts.lg.find(g => g.id === first.id)).toMatchObject({
      x: 6,
      y: 20,
      w: 3,
    });
    expect(after.document.blocks[0].definitionKey).toBe(first.definitionKey);
    const rows = await db.manager.find(DashboardRevision, {
      where: { dashboardId: id },
      order: { seq: 'ASC' },
    });
    expect(rows.map(r => [r.operation, r.authorKind, r.aiClientName])).toEqual([
      ['baseline', 'human', null],
      ['save', 'external-ai', 'Synthetic AI'],
    ]);
    expect(rows[0].revision).toBe(before.document.revision);
    expect(rows[1].revision).toBe(after.document.revision);
    expect(auth.assertGrant).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ grantId: 'grant-1' }),
      'dashboards:write',
    );
    const read = await service.read(principal(), id);
    expect(read.history.map(h => [h.operation, 'byYou' in h])).toEqual([
      ['save', true],
      ['baseline', false],
    ]);
  });

  it('removes a block together with its layout, and never the last one', async () => {
    const before = await state();
    const [, chart] = before.document.blocks;
    await update([{ type: 'removeBlock', blockId: chart.id }]);
    const after = await state();
    expect(after.document.blocks.map(b => b.id)).toEqual([before.document.blocks[0].id]);
    expect(after.document.layouts.lg.map(g => g.id)).toEqual([before.document.blocks[0].id]);
    const writes = await counts();
    expect(
      await failure(update([{ type: 'removeBlock', blockId: after.document.blocks[0].id }])),
    ).toEqual({ code: 'INVALID', reason: 'INVALID_INPUT' });
    expect(await counts()).toEqual(writes);
  });

  it("keeps a block's calculation, the block list and the conditions out of reach", async () => {
    const { document } = await state();
    const block = document.blocks[0];
    const writes = await counts();
    const rejected = async (change: unknown) => failure(update([change]));
    expect(await rejected({ type: 'addBlock', block })).toEqual({
      code: 'INVALID',
      reason: 'UNSUPPORTED_CHANGE',
    });
    expect(await rejected({ type: 'duplicateBlock', blockId: block.id, newId: 'x' })).toEqual({
      code: 'INVALID',
      reason: 'UNSUPPORTED_CHANGE',
    });
    expect(await rejected({ type: 'setConditions', conditions: null })).toEqual({
      code: 'INVALID',
      reason: 'UNSUPPORTED_CHANGE',
    });
    expect(
      await rejected({ type: 'updateBlock', blockId: block.id, patch: { measureRefs: [] } }),
    ).toEqual({ code: 'INVALID', reason: 'UNSUPPORTED_CHANGE' });
    expect(
      await rejected({ type: 'updateBlock', blockId: block.id, patch: { definitionKey: 'x' } }),
    ).toEqual({ code: 'INVALID', reason: 'UNSUPPORTED_CHANGE' });
    for (const bad of [
      { type: 'removeBlock', blockId: 'missing' },
      { type: 'removeBlock', blockId: block.id, extra: 1 },
      { type: 'renameDashboard', title: '' },
      { type: 'moveBlock', blockId: block.id, breakpoint: 'lg', x: -1, y: 0 },
      { type: 'updateBlock', blockId: block.id, patch: {} },
      { type: 'updateBlock', blockId: block.id, patch: { display: { sql: 'x' } } },
      'removeBlock',
      null,
    ])
      expect(await rejected(bad)).toEqual({ code: 'INVALID', reason: 'INVALID_INPUT' });
    expect(await failure(update([]))).toEqual({ code: 'INVALID', reason: 'INVALID_INPUT' });
    expect(
      await failure(
        update(Array.from({ length: 21 }, () => ({ type: 'renameDashboard', title: 'x' }))),
      ),
    ).toEqual({ code: 'INVALID', reason: 'INVALID_INPUT' });
    // Fifty distinct 2000-character values pass the document's own limits but not the request's size cap.
    const values = Array.from(
      { length: 50 },
      (_, i) => String(i).padStart(4, '0') + 'x'.repeat(1996),
    );
    expect(
      await failure(update([{ type: 'setFilters', filters: [{ column: 'category', values }] }])),
    ).toEqual({
      code: 'INVALID',
      reason: 'INVALID_INPUT',
    });
    expect(await counts()).toEqual(writes);
  });

  it('filters by a real column and refuses a column the source does not have', async () => {
    await update([{ type: 'setFilters', filters: [{ column: 'category', values: ['Site'] }] }]);
    expect((await state()).document.filters).toEqual([{ column: 'category', values: ['Site'] }]);
    const writes = await counts();
    const outcome = await failure(
      update([{ type: 'setFilters', filters: [{ column: 'nope', values: ['x'] }] }]),
    );
    expect(outcome).not.toBeNull();
    expect(await counts()).toEqual(writes);
  });

  it('answers a retry with the first answer, even after the dashboard moved on, and refuses other input', async () => {
    const current = await state();
    const request = {
      dashboardId: id,
      requestId: rid(900),
      expectedRevision: current.document.revision,
      expectedSourceRevision: current.sourceRevision,
      changes: [{ type: 'renameDashboard', title: 'Once' }],
    };
    const first = await service.update(principal(), request);
    // A person saves meanwhile, so the dashboard is at another revision than the request expected.
    const doc = JSON.parse(JSON.stringify((await state()).document));
    doc.title = 'A person after';
    await studio.save(
      id,
      {
        requestId: 'person-' + id,
        expectedRevision: doc.revision,
        expectedSourceRevision: sourceRevision,
        document: doc,
      },
      7,
    );
    const writes = await counts();
    expect(await service.update(principal(), request)).toEqual({
      dashboardId: id,
      revision: first.revision,
    });
    expect(await counts()).toEqual(writes);
    expect(
      await failure(
        service.update(principal(), {
          ...request,
          changes: [{ type: 'renameDashboard', title: 'Other' }],
        }),
      ),
    ).toEqual({ code: 'REQUEST_REUSED', reason: 'REQUEST_REUSED' });
    // A retry needs the same request; a new revision with the old ID is a different request.
    expect(
      await failure(
        service.update(principal(), {
          ...request,
          expectedRevision: (await state()).document.revision,
        }),
      ),
    ).toEqual({ code: 'REQUEST_REUSED', reason: 'REQUEST_REUSED' });
  });

  it('names a stale revision and a replaced file as retryable conflicts to re-read, and writes nothing', async () => {
    const current = await state();
    const writes = await counts();
    expect(
      await failure(
        update([{ type: 'renameDashboard', title: 'x' }], { expectedRevision: 'a'.repeat(64) }),
      ),
    ).toEqual({ code: 'CONFLICT', reason: 'REVISION_CHANGED' });
    expect(
      await failure(
        update([{ type: 'renameDashboard', title: 'x' }], {
          expectedSourceRevision: 'b'.repeat(64),
        }),
      ),
    ).toEqual({ code: 'CONFLICT', reason: 'SOURCE_CHANGED' });
    expect(await counts()).toEqual(writes);
    expect((await state()).document.revision).toBe(current.document.revision);
  });

  it('saves nothing for a change list that leaves the dashboard as it is', async () => {
    const current = await state();
    const writes = await counts();
    expect(await update([{ type: 'renameDashboard', title: current.document.title }])).toEqual({
      dashboardId: id,
      revision: current.document.revision,
      changed: false,
    });
    expect(await counts()).toEqual(writes);
  });

  it('refuses what the account does not alone own, a viewer, a missing scope and a revoked grant', async () => {
    const changes = [{ type: 'renameDashboard', title: 'Mine?' }];
    const current = await state();
    const call = (who: McpOAuthPrincipal) =>
      service.update(who, {
        dashboardId: id,
        requestId: rid(++n),
        expectedRevision: current.document.revision,
        expectedSourceRevision: current.sourceRevision,
        changes,
      });
    const writes = await counts();
    await expect(call(principal({ actorId: 8 }))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(call(principal({ scopes: ['dashboards:read'] }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await db.manager.update(EnterpriseMembership, { userId: 7 }, { role: 'viewer' });
    try {
      await expect(call(principal())).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      await db.manager.update(EnterpriseMembership, { userId: 7 }, { role: 'contributor' });
    }
    await db.manager.save(UserMapping, { dashboardId: id, userInfoId: 8 });
    try {
      await expect(call(principal())).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      await db.manager.delete(UserMapping, { dashboardId: id, userInfoId: 8 });
    }
    // A grant revoked while the save waited is read under the save's lock, and nothing is written.
    auth.assertGrant.mockRejectedValueOnce(new ForbiddenException());
    await expect(call(principal())).rejects.toBeInstanceOf(ForbiddenException);
    expect(await counts()).toEqual(writes);
  });
});
