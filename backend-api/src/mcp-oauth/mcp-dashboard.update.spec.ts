import { DashboardRevision } from '../dashboard-studio/entities/dashboard-revision.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
import { DashboardDeletionService } from '../dashboard/dashboard-deletion.service';
import {
  ArtifactComment,
  ArtifactCommentNotification,
  ArtifactCommentReceipt,
  ArtifactCommentThread,
} from '../reports/report-comment.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { DashboardDeleteReceipt } from '../dashboard/entities/dashboard-delete-receipt.entity';
import { DashboardToolException } from './mcp-dashboard.errors';
import { applyStudioOperation } from '../dashboard-studio/studio-operations';
import * as studioRestore from '../dashboard-studio/studio-restore';
import { deriveRestore } from '../dashboard-studio/studio-restore';
import { mcpError } from './mcp-server';
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
    connection: any,
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
        DashboardDeleteReceipt,
        DashboardPublication,
        ArtifactComment,
        ArtifactCommentNotification,
        ArtifactCommentReceipt,
        ArtifactCommentThread,
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
    connection = {
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
      new DashboardDeletionService(db),
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
    // The grant check must run in the transaction that writes, not in a read before it.
    const inTransaction: unknown[] = [];
    auth.assertGrant.mockImplementation(async manager => {
      inTransaction.push(manager.queryRunner?.isTransactionActive);
    });
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
    expect(inTransaction).toEqual([true]);
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
      changed: true,
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

  it("refuses an AI write whose replaced state could not be restored, and leaves a person's save alone", async () => {
    // The fixture cannot be made unrestorable without breaking the read first, so the check is forced.
    const check = jest.spyOn(studioRestore, 'assertRestorableRow').mockImplementation(() => {
      throw studioRestore.restoreUnsupported('no');
    });
    try {
      const writes = await counts();
      expect(await failure(update([{ type: 'renameDashboard', title: 'Not undoable' }]))).toEqual({
        code: 'INVALID',
        reason: 'UNSUPPORTED_CHANGE',
      });
      expect(await counts()).toEqual(writes);
      expect(check).toHaveBeenCalledTimes(1);
      const doc = JSON.parse(JSON.stringify((await state()).document));
      doc.title = 'A person';
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
      expect(check).toHaveBeenCalledTimes(1);
    } finally {
      check.mockRestore();
    }
  });

  it('records an AI change in the organization audit, in the transaction of the change', async () => {
    const events = async () =>
      (
        await db.manager.find(EnterpriseAuditEvent, {
          where: { resourceId: id },
          order: { id: 'ASC' },
        })
      ).map(event => event.action);
    const before = (await state()).document;
    await update([{ type: 'renameDashboard', title: 'Audited' }]);
    expect(await events()).toEqual(['dashboard.mcp-update']);
    const [baseline] = await db.manager.find(DashboardRevision, {
      where: { dashboardId: id },
      order: { seq: 'ASC' },
    });
    const current = await state();
    await service.restore(principal(), {
      dashboardId: id,
      requestId: rid(++n),
      revisionId: baseline.revisionId,
      expectedRevision: current.document.revision,
    });
    expect(await events()).toEqual(['dashboard.mcp-update', 'dashboard.mcp-restore']);
    // A person's save, and a refused AI write, leave no AI event.
    const doc = JSON.parse(JSON.stringify((await state()).document));
    doc.title = 'A person';
    await studio.save(
      id,
      {
        requestId: 'audit-person-' + id,
        expectedRevision: doc.revision,
        expectedSourceRevision: sourceRevision,
        document: doc,
      },
      7,
    );
    auth.assertGrant.mockRejectedValueOnce(new ForbiddenException());
    await update([{ type: 'renameDashboard', title: 'Refused' }]).catch(() => undefined);
    expect(await events()).toEqual(['dashboard.mcp-update', 'dashboard.mcp-restore']);
    expect(before.title).toBeTruthy();
  });

  describe('restore', () => {
    const histories = () =>
      db.manager.find(DashboardRevision, { where: { dashboardId: id }, order: { seq: 'ASC' } });
    const restore = async (revisionId: string, over: Record<string, unknown> = {}) => {
      const current = await state();
      return service.restore(principal(), {
        dashboardId: id,
        requestId: rid(++n),
        revisionId,
        expectedRevision: current.document.revision,
        ...over,
      });
    };
    // Row order of a GROUP BY is not defined, so the rows are compared as sets.
    const values = async () =>
      (await studio.get(id, 7)).preview.widgets.map((w: any) =>
        w.datas.map(row => JSON.stringify(row)).sort(),
      );

    it('brings a removed block back with a new id and the same numbers, and undoes a rename', async () => {
      const before = await state();
      const valuesBefore = await values();
      const chart = before.document.blocks[1];
      await update([{ type: 'removeBlock', blockId: chart.id }]);
      await update([{ type: 'renameDashboard', title: 'Renamed by AI' }]);
      const [baseline] = await histories();
      expect(baseline).toMatchObject({ operation: 'baseline', revision: before.document.revision });

      const result = await restore(baseline.revisionId);
      const after = await state();
      expect(result).toEqual({ dashboardId: id, revision: after.document.revision, changed: true });
      expect(after.document.title).toBe(before.document.title);
      expect(after.document.blocks.map(b => b.definitionKey)).toEqual(
        before.document.blocks.map(b => b.definitionKey),
      );
      expect(after.document.blocks[0].id).toBe(before.document.blocks[0].id);
      expect(after.document.blocks[1].id).not.toBe(chart.id);
      expect(await values()).toEqual(valuesBefore);
      const rows = await histories();
      expect(rows.map(r => [r.operation, r.authorKind])).toEqual([
        ['baseline', 'human'],
        ['save', 'external-ai'],
        ['save', 'external-ai'],
        ['restore', 'external-ai'],
      ]);
      expect(rows[3].aiClientName).toBe('Synthetic AI');
      // The restore is itself a state that can be restored: the rename is still in the history.
      expect(JSON.parse(rows[2].studioDocument).document.title).toBe('Renamed by AI');
    });

    it('answers a retry with the first answer and another input with REQUEST_REUSED', async () => {
      const before = await state();
      await update([{ type: 'renameDashboard', title: 'Changed' }]);
      const [baseline] = await histories();
      const current = await state();
      const request = {
        dashboardId: id,
        requestId: rid(950),
        revisionId: baseline.revisionId,
        expectedRevision: current.document.revision,
      };
      const first = await service.restore(principal(), request);
      const writes = await counts();
      expect(await service.restore(principal(), request)).toEqual({
        dashboardId: id,
        revision: first.revision,
        changed: true,
      });
      expect(await counts()).toEqual(writes);
      expect(
        await failure(service.restore(principal(), { ...request, revisionId: rid(951) })),
      ).toEqual({ code: 'REQUEST_REUSED', reason: 'REQUEST_REUSED' });
      expect((await state()).document.title).toBe(before.document.title);
    });

    it('saves nothing to restore the state the dashboard is already in', async () => {
      await update([{ type: 'renameDashboard', title: 'Changed' }]);
      const rows = await histories();
      const last = rows[rows.length - 1];
      const writes = await counts();
      expect(await restore(last.revisionId)).toEqual({
        dashboardId: id,
        revision: last.revision,
        changed: false,
      });
      expect(await counts()).toEqual(writes);
    });

    it("does not reach another dashboard's history, and refuses a stale revision", async () => {
      await update([{ type: 'renameDashboard', title: 'Changed' }]);
      const [baseline] = await histories();
      const other = (await ai.save({ draft: draft() }, 7)).data.id;
      const writes = await counts();
      const current = await state();
      const asOther = (revisionId: string) =>
        service.restore(principal(), {
          dashboardId: other,
          requestId: rid(++n),
          revisionId,
          expectedRevision: current.document.revision as string,
        });
      await expect(asOther(baseline.revisionId)).rejects.toBeInstanceOf(NotFoundException);
      expect(
        await failure(restore(baseline.revisionId, { expectedRevision: 'a'.repeat(64) })),
      ).toEqual({
        code: 'CONFLICT',
        reason: 'REVISION_CHANGED',
      });
      expect(await counts()).toEqual(writes);
    });

    it('leaves the legacy pivot column alone', async () => {
      const marker = JSON.stringify([{ legacy: 'pivot' }]);
      await update([{ type: 'renameDashboard', title: 'Changed' }]);
      await db.manager.update(Dashboard, { id }, { pivotDefinitions: marker });
      const [baseline] = await histories();
      await restore(baseline.revisionId);
      expect((await db.manager.findOneBy(Dashboard, { id })).pivotDefinitions).toBe(marker);
    });

    it('refuses with RESTORE_STALE, not retryable, when the save cannot carry the old state, and lets a refusal through', async () => {
      const chart = (await state()).document.blocks[1];
      await update([{ type: 'removeBlock', blockId: chart.id }]);
      const [baseline] = await histories();
      const writes = await counts();
      const prepare = jest.spyOn(ai, 'prepareSave');
      try {
        // The inputs to the save come from the server's own history row, so an uncoded 400 or 409
        // from it means the old state no longer fits today's metrics or columns.
        for (const error of [
          new ConflictException('Saved metric changed.'),
          new BadRequestException('x'),
        ]) {
          prepare.mockRejectedValueOnce(error);
          let failed: any;
          await restore(baseline.revisionId).catch(e => (failed = e));
          expect(failed).toBeInstanceOf(DashboardToolException);
          expect(mcpError(failed)).toMatchObject({
            code: 'INVALID',
            retryable: false,
            detail: { reason: 'RESTORE_STALE' },
          });
        }
        prepare.mockRejectedValueOnce(new ForbiddenException());
        await expect(restore(baseline.revisionId)).rejects.toBeInstanceOf(ForbiddenException);
      } finally {
        prepare.mockRestore();
      }
      expect(await counts()).toEqual(writes);
    });

    it('is stale when the source, the business basis or the saved form moved since', async () => {
      await update([{ type: 'renameDashboard', title: 'Changed' }]);
      const [baseline] = await histories();
      const current = await state();
      const snapshot = JSON.parse(
        (await db.manager.findOneBy(Dashboard, { id })).structuredDefinition ?? 'null',
      );
      const attempt =
        (over: Record<string, unknown>, snap: unknown = snapshot) =>
        () =>
          deriveRestore(
            id,
            { document: { ...current.document, ...over } as never, snapshot: snap, analysis: {} },
            baseline,
            current.document.revision,
          );
      const code = (call: () => unknown) => {
        try {
          call();
        } catch (error: any) {
          return error.getResponse().code;
        }
        return null;
      };
      expect(code(attempt({}))).toBeNull();
      expect(code(attempt({ sourceId: 999 }))).toBe('RESTORE_STALE');
      expect(code(attempt({ businessBasis: { version: 1, columns: [] } }))).toBe('RESTORE_STALE');
      expect(code(attempt({}, snapshot ? null : { schemaVersion: 2 }))).toBe('RESTORE_STALE');
      // Conditions are not restored in this version, in either direction.
      expect(code(attempt({ conditions: { sourceRevision: 'a'.repeat(64) } }))).toBe(
        'UNSUPPORTED_CHANGE',
      );
    });

    it('refuses a damaged history row and a state it cannot rebuild a block from', async () => {
      await update([{ type: 'renameDashboard', title: 'Changed' }]);
      const [baseline] = await histories();
      const unsupported = { code: 'INVALID', reason: 'UNSUPPORTED_CHANGE' };
      const writes = await counts();
      const original = { ...baseline };
      for (const damage of [
        { analysisDefinition: null },
        { revision: 'c'.repeat(64) },
        { studioDocument: '{"document":{}}' },
      ]) {
        await db.manager.update(DashboardRevision, { seq: baseline.seq }, damage);
        expect(await failure(restore(baseline.revisionId))).toEqual(unsupported);
        await db.manager.update(DashboardRevision, { seq: baseline.seq }, original);
      }
      expect(await counts()).toEqual(writes);
    });

    it('refuses when no block of the saved state is still the same block', async () => {
      // A save by a person can hand a new block an old id by position, so this state is built directly:
      // today's dashboard has the same calculations under other ids.
      await update([{ type: 'renameDashboard', title: 'Changed' }]);
      const [baseline] = await histories();
      const current = await state();
      const renamed = JSON.parse(JSON.stringify(current.document));
      renamed.blocks.forEach((b, i) => (b.id = `other-${i}`));
      for (const breakpoint of ['lg', 'md', 'xs'])
        renamed.layouts[breakpoint].forEach((g, i) => (g.id = `other-${i}`));
      const snapshot = JSON.parse(
        (await db.manager.findOneBy(Dashboard, { id })).structuredDefinition ?? 'null',
      );
      expect(() =>
        deriveRestore(
          id,
          { document: renamed, snapshot, analysis: {} },
          baseline,
          current.document.revision,
        ),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'UNSUPPORTED_CHANGE' }),
        }),
      );
      // With one block still the same block, the others come back under temporary ids.
      renamed.blocks[0].id = current.document.blocks[0].id;
      renamed.layouts.lg[0].id = current.document.blocks[0].id;
      renamed.layouts.md[0].id = current.document.blocks[0].id;
      renamed.layouts.xs[0].id = current.document.blocks[0].id;
      const { document } = deriveRestore(
        id,
        { document: renamed, snapshot, analysis: {} },
        baseline,
        current.document.revision,
      );
      expect(document.blocks[0].id).toBe(current.document.blocks[0].id);
      expect(document.blocks[1].id).toMatch(/^new:/);
    });
  });

  describe('removal', () => {
    const principalDelete = (over: Partial<McpOAuthPrincipal> = {}) =>
      principal({ scopes: ['dashboards:read', 'dashboards:write', 'dashboards:delete'], ...over });
    const impact = () => service.removalImpact(principalDelete(), id);
    const remove = async (over: Record<string, unknown> = {}, who = principalDelete()) =>
      service.remove(who, {
        dashboardId: id,
        requestId: rid(++n),
        expectedRevision: (await impact()).revision,
        ...over,
      });
    const share = () =>
      db.manager.insert(EnterpriseResourceGrant, {
        resourceKind: 'dashboard',
        resourceId: id,
        recipientId: 8,
        ownerId: 7,
        organizationId: 1,
        version: 1,
        read: true,
        edit: false,
        publish: false,
        export: false,
      });

    it('reports what uses a dashboard, with the revision a removal must name', async () => {
      const free = await impact();
      expect(free).toMatchObject({ dashboardId: id, canDelete: true });
      expect(free.revision).toMatch(/^[a-f0-9]{64}$/);
      expect(free.dependencies.every(d => d.count === 0)).toBe(true);
      await share();
      const used = await impact();
      expect(used.canDelete).toBe(false);
      expect(used.dependencies).toContainEqual({ kind: 'directPermissions', count: 1 });
    });

    it('refuses with the list of what still uses it, not retryable, and deletes nothing', async () => {
      await share();
      const writes = await counts();
      let error: any;
      await remove().catch(e => (error = e));
      expect(mcpError(error)).toMatchObject({
        code: 'INVALID',
        retryable: false,
        detail: {
          reason: 'HAS_DEPENDENCIES',
          dependencies: expect.arrayContaining([{ kind: 'directPermissions', count: 1 }]),
        },
      });
      expect(await counts()).toEqual(writes);
      expect(await db.manager.findOneBy(Dashboard, { id })).toBeTruthy();
    });

    it('deletes an unused dashboard with its comments, history and links, and answers a retry from the receipt', async () => {
      const doc = JSON.parse(JSON.stringify((await state()).document));
      await update([{ type: 'renameDashboard', title: 'Before removal' }]);
      expect(
        await db.manager.count(DashboardRevision, { where: { dashboardId: id } }),
      ).toBeGreaterThan(0);
      const request = {
        dashboardId: id,
        requestId: rid(970),
        expectedRevision: (await impact()).revision,
      };
      const inTransaction: unknown[] = [];
      auth.assertGrant.mockImplementation(async manager => {
        inTransaction.push(manager.queryRunner?.isTransactionActive);
      });
      const result = await service.remove(principalDelete(), request);
      expect(result).toEqual({ dashboardId: id, deleted: true, replayed: false });
      // The grant check ran inside the deleting transaction.
      expect(inTransaction).toEqual([true]);
      expect(await db.manager.findOneBy(Dashboard, { id })).toBeNull();
      expect(await db.manager.count(DashboardRevision, { where: { dashboardId: id } })).toBe(0);
      expect(await db.manager.count(DashboardWidget, { where: { dashboardId: id } })).toBe(0);
      expect(await db.manager.count(UserMapping, { where: { dashboardId: id } })).toBe(0);
      expect(
        await db.manager.count(EnterpriseAuditEvent, {
          where: { action: 'dashboard-deletion.completed' },
        }),
      ).toBe(1);
      expect(doc.blocks.length).toBeGreaterThan(0);
      expect(
        await db.manager.count(EnterpriseAuditEvent, {
          where: { action: 'dashboard.mcp-remove', resourceId: id },
        }),
      ).toBe(1);
      // The dashboard is gone, so the retry is recognised by the receipt.
      expect(await service.remove(principalDelete(), request)).toEqual({
        dashboardId: id,
        deleted: true,
        replayed: true,
      });
      expect(
        await db.manager.count(EnterpriseAuditEvent, {
          where: { action: 'dashboard-deletion.completed' },
        }),
      ).toBe(1);
      expect(
        await failure(
          service.remove(principalDelete(), { ...request, expectedRevision: 'a'.repeat(64) }),
        ),
      ).toEqual({ code: 'REQUEST_REUSED', reason: 'REQUEST_REUSED' });
    });

    it('asks to read again when the dashboard changed after the impact was read', async () => {
      const stale = (await impact()).revision;
      await update([{ type: 'renameDashboard', title: 'Moved on' }]);
      const writes = await counts();
      expect(await failure(remove({ expectedRevision: stale }))).toEqual({
        code: 'CONFLICT',
        reason: 'REVISION_CHANGED',
      });
      expect(await counts()).toEqual(writes);
      expect(await db.manager.findOneBy(Dashboard, { id })).toBeTruthy();
    });

    it('refuses what the account does not alone own, a missing scope, a viewer and a revoked grant', async () => {
      const revision = (await impact()).revision;
      const receipts = await db.manager.count(DashboardDeleteReceipt);
      const attempt = (who: McpOAuthPrincipal) =>
        service.remove(who, { dashboardId: id, requestId: rid(++n), expectedRevision: revision });
      await expect(attempt(principalDelete({ actorId: 8 }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      // Write alone is not enough to delete.
      await expect(attempt(principal())).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.removalImpact(principal(), id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await db.manager.update(EnterpriseMembership, { userId: 7 }, { role: 'viewer' });
      try {
        await expect(attempt(principalDelete())).rejects.toBeInstanceOf(ForbiddenException);
      } finally {
        await db.manager.update(EnterpriseMembership, { userId: 7 }, { role: 'contributor' });
      }
      auth.assertGrant.mockRejectedValueOnce(new ForbiddenException());
      await expect(attempt(principalDelete())).rejects.toBeInstanceOf(ForbiddenException);
      expect(await db.manager.findOneBy(Dashboard, { id })).toBeTruthy();
      expect(await db.manager.count(DashboardDeleteReceipt)).toBe(receipts);
    });

    it('limits deletions to 10 a minute per account, as a code and not a server error', async () => {
      const revision = (await impact()).revision;
      let last: any;
      for (let i = 0; i < 11; i++)
        last = await failure(
          service.remove(principalDelete(), {
            dashboardId: id,
            requestId: rid(1000 + i),
            expectedRevision: 'f'.repeat(64),
          }),
        );
      expect(last).toEqual({ code: 'LIMIT', reason: 'RATE_LIMITED' });
      expect(revision).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
