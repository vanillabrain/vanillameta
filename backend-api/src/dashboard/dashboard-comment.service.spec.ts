jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import {
  REPORT_COMMENT_ENTITIES,
  ArtifactComment,
  ArtifactCommentNotification,
  ArtifactCommentReceipt,
  ArtifactCommentThread,
} from '../reports/report-comment.entity';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { DashboardShare } from './entities/dashboard_share.entity';
import { DashboardPublication } from './entities/dashboard-publication.entity';
import { DashboardDeleteReceipt } from './entities/dashboard-delete-receipt.entity';
import { DashboardDeletionService } from './dashboard-deletion.service';
import { dashboardRevision } from './dashboard-revision';
import { deleteDashboardComments } from './dashboard-comment-cleanup';
import { DashboardCommentService } from './dashboard-comment.service';
import { PersonalLibraryState } from './entities/personal-library-state.entity';
import { McpDashboardService } from '../mcp-oauth/mcp-dashboard.service';
import { mcpError } from '../mcp-oauth/mcp-server';

const owner = { id: 1, authVersion: 0 },
  reader = { id: 2, authVersion: 0 },
  editor = { id: 3, authVersion: 0 },
  outsider = { id: 4, authVersion: 0 },
  otherOrg = { id: 5, authVersion: 0 };
const ANALYSIS = '1',
  LEGACY = '2',
  PLAIN = '3',
  GOVERNED = '4';
const widget = (title: string, type = 'CHART_COLUMN', blockId?: string) => ({
  ...(blockId ? { blockId } : {}),
  title,
  description: '',
  type,
  sql: 'SELECT sum(amount) AS value FROM source',
  valueField: 'value',
});
const definition = (widgets: unknown[]) =>
  JSON.stringify({ databaseId: 1, title: 'Sales', explanation: '', widgets });
const ANALYSIS_WIDGETS = [
  widget('Revenue', 'BOARD_NUMERIC', 'block-a'),
  widget('Channels', 'CHART_COLUMN', 'block-b'),
];
const LEGACY_WIDGETS = [widget('Orders', 'BOARD_NUMERIC'), widget('Trend', 'CHART_LINE')];

/**
 * Opt-in PostgreSQL run in a throwaway schema, e.g. VM_REPORT_COMMENT_POSTGRES_PORT=55491
 * (also _HOST, _USER, _PASSWORD, _DB).
 */
const pgPort = process.env.VM_REPORT_COMMENT_POSTGRES_PORT;
const pgConnection = () => ({
  type: 'postgres' as const,
  host: process.env.VM_REPORT_COMMENT_POSTGRES_HOST || '127.0.0.1',
  port: Number(pgPort),
  username: process.env.VM_REPORT_COMMENT_POSTGRES_USER || 'postgres',
  password: process.env.VM_REPORT_COMMENT_POSTGRES_PASSWORD,
  database: process.env.VM_REPORT_COMMENT_POSTGRES_DB || 'postgres',
});

describe(`dashboard comments with real ${pgPort ? 'PostgreSQL' : 'SQLite'} transactions`, () => {
  let admin: DataSource | undefined, schema: string | undefined;
  let db: DataSource, service: DashboardCommentService, access: SourceAccessService;
  beforeAll(async () => {
    if (pgPort) admin = await new DataSource(pgConnection()).initialize();
  });
  afterAll(async () => {
    await admin?.destroy();
  });

  const revision = async (id: string) =>
    dashboardRevision(await db.manager.findOneByOrFail(Dashboard, { id: Number(id) }));
  const thread = async (
    id: string,
    anchor: unknown = { kind: 'whole' },
    body = 'Check this chart',
  ) => ({ requestId: randomUUID(), revision: await revision(id), anchor, body });
  const status = (expectedStatusVersion: number, value: 'open' | 'resolved' = 'resolved') => ({
    requestId: randomUUID(),
    status: value,
    expectedStatusVersion,
  });
  const reply = (body = 'Fixed') => ({ requestId: randomUUID(), body });
  const counts = async () => ({
    threads: await db.manager.count(ArtifactCommentThread),
    comments: await db.manager.count(ArtifactComment),
    receipts: await db.manager.count(ArtifactCommentReceipt),
  });
  const redefine = (id: string, widgets: unknown[]) =>
    db.manager.update(Dashboard, Number(id), { analysisDefinition: definition(widgets) });
  const grant = (resourceKind: 'dashboard' | 'source', resourceId: number, recipientId: number) =>
    db.manager.insert(EnterpriseResourceGrant, {
      resourceKind,
      resourceId,
      recipientId,
      organizationId: 1,
      ownerId: 1,
      version: 1,
      read: true,
      edit: recipientId === editor.id,
    });

  beforeEach(async () => {
    if (admin) {
      schema = 'vm_dashboard_comment_' + randomUUID().replace(/-/g, '').slice(0, 16);
      await admin.query(`CREATE SCHEMA "${schema}"`);
    }
    db = await new DataSource({
      ...(admin
        ? { ...pgConnection(), schema, extra: { options: `-c search_path=${schema}` } }
        : { type: 'sqlite' as const, database: ':memory:' }),
      synchronize: true,
      entities: [
        User,
        UserMapping,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
        StudioPublication,
        Database,
        Dataset,
        Widget,
        Dashboard,
        DashboardWidget,
        DashboardShare,
        DashboardPublication,
        DashboardDeleteReceipt,
        PersonalLibraryState,
        ...REPORT_COMMENT_ENTITIES,
      ],
    }).initialize();
    // Fresh tables and sequences: rows inserted in order get ids 1, 2, ... on both drivers.
    for (const uid of [1, 2, 3, 4, 5]) {
      await db.manager.insert(User, {
        id: uid,
        userId: `user-${uid}`,
        email: `synthetic-${uid}@example.invalid`,
        password: 'synthetic',
        active: true,
        authVersion: 0,
      });
      await db.manager.insert(EnterpriseMembership, {
        userId: uid,
        organizationId: uid === otherOrg.id ? 2 : 1,
        role: uid === owner.id ? 'admin' : 'member',
        team: 'Team',
      });
    }
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 1,
      name: 'PRIVATE_SOURCE',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    for (const [id, analysisDefinition, governed] of [
      [1, definition(ANALYSIS_WIDGETS), false],
      [2, definition(LEGACY_WIDGETS), false],
      [3, null, false],
      [4, definition(ANALYSIS_WIDGETS), true],
    ] as const) {
      await db.manager.insert(Dashboard, {
        id,
        title: `Board ${id}`,
        analysisDefinition,
        governed,
      });
      await db.manager.insert(UserMapping, { dashboardId: id, userInfoId: 1 });
    }
    for (const recipient of [reader.id, editor.id]) {
      await grant('source', 1, recipient);
      for (const dashboardId of [1, 2, 4]) await grant('dashboard', dashboardId, recipient);
    }
    access = new SourceAccessService(db, new EnterpriseResourcePolicyService(db));
    service = new DashboardCommentService(db, access);
  });
  afterEach(async () => {
    await db.destroy();
    if (admin && schema) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  });

  it('rejects an omitted JWT epoch on every entrypoint without writing', async () => {
    const legacy = { id: 1, authVersion: undefined };
    const tid = randomUUID();
    await expect(service.list(ANALYSIS, legacy)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.createThread(ANALYSIS, await thread(ANALYSIS), legacy),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.reply(ANALYSIS, tid, reply(), legacy)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.setThreadStatus(ANALYSIS, tid, status(0), legacy)).rejects.toMatchObject({
      status: 403,
    });
    expect(await counts()).toEqual({ threads: 0, comments: 0, receipts: 0 });
  });

  it('lets the owner comment on the whole dashboard and on one chart', async () => {
    const list = await service.list(ANALYSIS, owner);
    expect(list).toEqual({
      revision: await revision(ANALYSIS),
      canManage: true,
      blockAnchors: true,
      blocks: [
        { blockId: 'block-a', title: 'Revenue', type: 'BOARD_NUMERIC' },
        { blockId: 'block-b', title: 'Channels', type: 'CHART_COLUMN' },
      ],
      threads: [],
    });
    const whole = await service.createThread(ANALYSIS, await thread(ANALYSIS), owner);
    const block = await service.createThread(
      ANALYSIS,
      await thread(ANALYSIS, { kind: 'block', blockId: 'block-b' }, 'Wrong channel split'),
      owner,
    );
    expect(whole).toMatchObject({
      replayed: false,
      operation: 'dashboard.thread.create',
      resultId: whole.thread.id,
      thread: { anchor: { kind: 'whole' }, location: 'exact', changed: false },
    });
    expect(block.thread).toEqual({
      id: block.resultId,
      anchor: { kind: 'block', blockId: 'block-b', title: 'Channels', type: 'CHART_COLUMN' },
      location: 'exact',
      changed: false,
      status: 'open',
      statusVersion: 0,
      createdAt: expect.any(String),
      author: { kind: 'user', userId: 'user-1', clientName: null },
      mine: true,
      resolvedAt: null,
      resolvedBy: null,
      comments: [
        {
          id: expect.any(String),
          body: 'Wrong channel split',
          createdAt: expect.any(String),
          author: { kind: 'user', userId: 'user-1', clientName: null },
          mine: true,
        },
      ],
    });
    const stored = await db.manager.findOneByOrFail(ArtifactCommentThread, {
      id: block.resultId,
    });
    expect(stored).toMatchObject({
      artifactKind: 'dashboard',
      artifactId: '1',
      version: 0,
      artifactRevision: await revision(ANALYSIS),
      anchorKind: 'block',
      anchorBlockId: 'block-b',
      anchorLabel: 'Channels',
      anchorType: 'CHART_COLUMN',
    });
    const after = await service.list(ANALYSIS, owner);
    expect(after.threads.map(row => row.id).sort()).toEqual(
      [whole.resultId, block.resultId].sort(),
    );
    expect(JSON.stringify(after)).not.toMatch(/synthetic-|"createdBy"|"authorId"|SELECT|"sql"/);
  });

  it('lets a policy reader comment and see only their own threads; editors manage all', async () => {
    const mine = await service.createThread(ANALYSIS, await thread(ANALYSIS), owner);
    const theirs = await service.createThread(
      ANALYSIS,
      await thread(ANALYSIS, { kind: 'block', blockId: 'block-a' }, 'Revenue looks low'),
      reader,
    );
    const readerList = await service.list(ANALYSIS, reader);
    expect(readerList).toMatchObject({ canManage: false, blockAnchors: true });
    expect(readerList.threads.map(row => row.id)).toEqual([theirs.resultId]);
    await expect(service.reply(ANALYSIS, mine.resultId, reply(), reader)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.setThreadStatus(ANALYSIS, theirs.resultId, status(0), reader),
    ).rejects.toMatchObject({ status: 403 });
    const answered = await service.reply(ANALYSIS, theirs.resultId, reply('Still low'), reader);
    expect(answered.thread.comments.map(row => row.body)).toEqual([
      'Revenue looks low',
      'Still low',
    ]);

    const editorList = await service.list(ANALYSIS, editor);
    expect(editorList.canManage).toBe(true);
    expect(editorList.threads.map(row => row.id).sort()).toEqual(
      [mine.resultId, theirs.resultId].sort(),
    );
    const resolved = await service.setThreadStatus(ANALYSIS, theirs.resultId, status(0), editor);
    expect(resolved.thread).toMatchObject({
      status: 'resolved',
      statusVersion: 1,
      resolvedBy: 'user-3',
      mine: false,
      author: { userId: 'user-2' },
    });
    await expect(
      service.setThreadStatus(ANALYSIS, theirs.resultId, status(0, 'open'), owner),
    ).rejects.toMatchObject({ status: 409 });
    const reopened = await service.setThreadStatus(
      ANALYSIS,
      theirs.resultId,
      status(1, 'open'),
      owner,
    );
    expect(reopened.thread).toMatchObject({ status: 'open', statusVersion: 2, resolvedBy: null });
    expect((await service.list(ANALYSIS, reader)).threads[0]).toMatchObject({ status: 'open' });
  });

  it('denies users without access, other organizations, unknown and governed dashboards', async () => {
    for (const actor of [outsider, otherOrg]) {
      await expect(service.list(ANALYSIS, actor)).rejects.toMatchObject({ status: 403 });
      await expect(
        service.createThread(ANALYSIS, await thread(ANALYSIS), actor),
      ).rejects.toMatchObject({ status: 403 });
    }
    await expect(service.list('99', owner)).rejects.toMatchObject({ status: 403 });
    await expect(service.list('abc', owner)).rejects.toMatchObject({ status: 400 });
    for (const actor of [owner, reader]) {
      await expect(service.list(GOVERNED, actor)).rejects.toMatchObject({ status: 403 });
      await expect(
        service.createThread(GOVERNED, await thread(GOVERNED), actor),
      ).rejects.toMatchObject({ status: 403 });
    }
    await db.manager.update(Dashboard, 1, { assetActive: false });
    await expect(service.list(ANALYSIS, owner)).rejects.toMatchObject({ status: 403 });
    await expect(
      service.createThread(ANALYSIS, await thread(ANALYSIS), owner),
    ).rejects.toMatchObject({ status: 403 });
    expect(await counts()).toEqual({ threads: 0, comments: 0, receipts: 0 });
  });

  it('allows block anchors only on dashboards with an analysis definition and a current block', async () => {
    expect(await service.list(PLAIN, owner)).toMatchObject({ blockAnchors: false, blocks: [] });
    await expect(
      service.createThread(
        PLAIN,
        await thread(PLAIN, { kind: 'block', blockId: 'block-a' }),
        owner,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.createThread(
        ANALYSIS,
        await thread(ANALYSIS, { kind: 'block', blockId: 'block-z' }),
        owner,
      ),
    ).rejects.toMatchObject({ status: 400 });
    for (const anchor of [
      { kind: 'block', blockId: 'block-a', title: 'forged' },
      { kind: 'text', start: 0, end: 1 },
    ])
      await expect(
        service.createThread(ANALYSIS, await thread(ANALYSIS, anchor), owner),
      ).rejects.toMatchObject({ status: 400 });
    expect(await counts()).toEqual({ threads: 0, comments: 0, receipts: 0 });
    const whole = await service.createThread(PLAIN, await thread(PLAIN), owner);
    expect(whole.thread).toMatchObject({ anchor: { kind: 'whole' }, location: 'exact' });
  });

  it('rejects a stale revision with 409 and writes nothing', async () => {
    const stale = await thread(ANALYSIS);
    await redefine(ANALYSIS, [ANALYSIS_WIDGETS[1]]);
    await expect(service.createThread(ANALYSIS, stale, owner)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      service.createThread(
        ANALYSIS,
        { ...(await thread(ANALYSIS)), revision: 'f'.repeat(64) },
        owner,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await counts()).toEqual({ threads: 0, comments: 0, receipts: 0 });
  });

  it('marks stored block ids exact or detached, and changed charts', async () => {
    const created = await service.createThread(
      ANALYSIS,
      await thread(ANALYSIS, { kind: 'block', blockId: 'block-a' }),
      owner,
    );
    const located = async () =>
      (await service.list(ANALYSIS, owner)).threads.find(row => row.id === created.resultId);
    await redefine(ANALYSIS, [ANALYSIS_WIDGETS[1], ANALYSIS_WIDGETS[0]]);
    expect(await located()).toMatchObject({ location: 'exact', changed: false });
    await redefine(ANALYSIS, [widget('Net revenue', 'CHART_LINE', 'block-a'), ANALYSIS_WIDGETS[1]]);
    expect(await located()).toMatchObject({
      anchor: { blockId: 'block-a', title: 'Revenue', type: 'BOARD_NUMERIC' },
      location: 'exact',
      changed: true,
    });
    await redefine(ANALYSIS, [ANALYSIS_WIDGETS[1]]);
    expect(await located()).toMatchObject({ location: 'detached', changed: false });
  });

  it('detaches positional legacy ids when the chart at that position changed', async () => {
    const list = await service.list(LEGACY, owner);
    expect(list.blocks).toEqual([
      { blockId: 'legacy-2-0', title: 'Orders', type: 'BOARD_NUMERIC' },
      { blockId: 'legacy-2-1', title: 'Trend', type: 'CHART_LINE' },
    ]);
    const created = await service.createThread(
      LEGACY,
      await thread(LEGACY, { kind: 'block', blockId: 'legacy-2-0' }),
      reader,
    );
    const located = async () => (await service.list(LEGACY, reader)).threads[0];
    expect(created.thread).toMatchObject({ location: 'exact', changed: false });
    await redefine(LEGACY, [LEGACY_WIDGETS[1]]);
    expect(await located()).toMatchObject({ location: 'detached', changed: true });
    await redefine(LEGACY, [LEGACY_WIDGETS[0]]);
    expect(await located()).toMatchObject({ location: 'exact', changed: false });
    await redefine(LEGACY, [LEGACY_WIDGETS[1], LEGACY_WIDGETS[0]]);
    expect(await located()).toMatchObject({ location: 'detached', changed: true });
  });

  it('replays the same requestId and rejects reuse, including a report requestId', async () => {
    const input = await thread(ANALYSIS);
    const first = await service.createThread(ANALYSIS, input, owner);
    const before = await counts();
    await redefine(ANALYSIS, [ANALYSIS_WIDGETS[1]]);
    const again = await service.createThread(ANALYSIS, input, owner);
    expect(again).toMatchObject({ replayed: true, resultId: first.resultId });
    expect(again.thread.id).toBe(first.thread.id);
    expect(await counts()).toEqual(before);
    await expect(
      service.createThread(ANALYSIS, { ...input, body: 'Different' }, owner),
    ).rejects.toMatchObject({ status: 409, code: 'REQUEST_REUSED', resultId: first.resultId });

    const answer = reply();
    const replied = await service.reply(ANALYSIS, first.resultId, answer, owner);
    expect(await service.reply(ANALYSIS, first.resultId, answer, owner)).toMatchObject({
      replayed: true,
      resultId: replied.resultId,
    });
    await expect(
      service.setThreadStatus(
        ANALYSIS,
        first.resultId,
        { ...status(0), requestId: answer.requestId },
        owner,
      ),
    ).rejects.toMatchObject({ status: 409, code: 'REQUEST_REUSED', threadId: first.resultId });

    const reportRequest = randomUUID();
    await db.manager.insert(ArtifactCommentReceipt, {
      actorId: owner.id,
      organizationKey: 1,
      requestId: reportRequest,
      operation: 'thread.create',
      payloadHash: 'f'.repeat(64),
      resultId: randomUUID(),
      createdAt: new Date().toISOString(),
    });
    const crossing = { ...(await thread(ANALYSIS)), requestId: reportRequest };
    const settled = await counts();
    await expect(service.createThread(ANALYSIS, crossing, owner)).rejects.toMatchObject({
      status: 409,
      code: 'REQUEST_REUSED',
    });
    await expect(
      service.createThread(ANALYSIS, crossing, owner).catch(error => error.getResponse()),
    ).resolves.not.toHaveProperty('threadId');
    expect(await counts()).toEqual(settled);
  });

  it('answers 404 for thread ids of reports or other dashboards', async () => {
    const elsewhere = await service.createThread(PLAIN, await thread(PLAIN), owner);
    const reportThread = randomUUID();
    await db.manager.insert(ArtifactCommentThread, {
      id: reportThread,
      artifactKind: 'report',
      artifactId: randomUUID(),
      version: 1,
      anchorKind: 'whole',
      status: 'open',
      statusVersion: 0,
      createdBy: owner.id,
      authorKind: 'user',
      createdAt: new Date().toISOString(),
    });
    for (const threadId of [elsewhere.resultId, reportThread]) {
      await expect(service.reply(ANALYSIS, threadId, reply(), owner)).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        service.setThreadStatus(ANALYSIS, threadId, status(0), owner),
      ).rejects.toMatchObject({ status: 404 });
    }
    await expect(service.reply(ANALYSIS, 'not-a-uuid', reply(), owner)).rejects.toMatchObject({
      status: 400,
    });
    expect((await service.list(ANALYSIS, owner)).threads).toEqual([]);
  });

  it('enforces body, thread, comment and text limits per dashboard', async () => {
    await expect(
      service.createThread(ANALYSIS, await thread(ANALYSIS, undefined, 'x'.repeat(4001)), owner),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.createThread(ANALYSIS, await thread(ANALYSIS, undefined, '   '), owner),
    ).rejects.toMatchObject({ status: 400 });
    const created = await service.createThread(ANALYSIS, await thread(ANALYSIS), owner);
    const now = new Date().toISOString();
    await db.manager.insert(
      ArtifactComment,
      Array.from({ length: 199 }, () => ({
        id: randomUUID(),
        threadId: created.resultId,
        authorId: owner.id,
        authorKind: 'user',
        body: 'filler',
        createdAt: now,
      })),
    );
    await expect(service.reply(ANALYSIS, created.resultId, reply(), owner)).rejects.toMatchObject({
      status: 409,
      code: 'COMMENT_LIMIT',
    });
    for (let batch = 0; batch < 499; batch += 50)
      await db.manager.insert(
        ArtifactCommentThread,
        Array.from({ length: Math.min(50, 499 - batch) }, () => ({
          id: randomUUID(),
          artifactKind: 'dashboard',
          artifactId: '1',
          version: 0,
          anchorKind: 'whole',
          status: 'open',
          statusVersion: 0,
          createdBy: owner.id,
          authorKind: 'user',
          createdAt: now,
        })),
      );
    await expect(
      service.createThread(ANALYSIS, await thread(ANALYSIS), owner),
    ).rejects.toMatchObject({ status: 409, code: 'COMMENT_LIMIT' });
    expect(await service.createThread(PLAIN, await thread(PLAIN), owner)).toMatchObject({
      replayed: false,
    });

    const plain = await db.manager.findOneByOrFail(ArtifactCommentThread, { artifactId: '3' });
    await db.manager.insert(ArtifactComment, {
      id: randomUUID(),
      threadId: plain.id,
      authorId: owner.id,
      authorKind: 'user',
      body: 'y'.repeat(2 * 1024 * 1024 - 20),
      createdAt: now,
    });
    await expect(
      service.reply(PLAIN, plain.id, reply('z'.repeat(40)), owner),
    ).rejects.toMatchObject({ status: 409, code: 'COMMENT_LIMIT' });
  });

  it('removes only that dashboard comments, threads and receipts on deletion', async () => {
    const doomed = await service.createThread(PLAIN, await thread(PLAIN), owner);
    await service.reply(PLAIN, doomed.resultId, reply(), owner);
    await service.setThreadStatus(PLAIN, doomed.resultId, status(0), owner);
    const kept = await service.createThread(ANALYSIS, await thread(ANALYSIS), reader);
    const notification = (artifactId: string, threadId: string) => ({
      id: randomUUID(),
      recipientId: owner.id,
      organizationKey: 1,
      artifactKind: 'dashboard',
      artifactId,
      threadId,
      event: 'thread.created',
      actorKind: 'user',
      actorId: reader.id,
      aiClientName: null,
      relationVersion: null,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    await db.manager.insert(ArtifactCommentNotification, [
      notification(String(PLAIN), doomed.resultId),
      notification(String(ANALYSIS), kept.resultId),
    ]);
    const reportReceipt = {
      actorId: owner.id,
      organizationKey: 1,
      requestId: randomUUID(),
      operation: 'thread.create',
      payloadHash: 'f'.repeat(64),
      resultId: doomed.resultId,
      createdAt: new Date().toISOString(),
    };
    await db.manager.insert(ArtifactCommentReceipt, reportReceipt);
    expect(await counts()).toEqual({ threads: 2, comments: 3, receipts: 5 });

    const deletion = new DashboardDeletionService(db);
    const impact = (await deletion.impact(3, owner.id)).data;
    expect(impact.canDelete).toBe(true);
    await deletion.remove(3, owner.id, {
      requestId: randomUUID(),
      expectedRevision: impact.revision,
      expectedActorId: owner.id,
      expectedOrganizationId: impact.organizationId,
    });
    expect(await db.manager.findOneBy(Dashboard, { id: 3 })).toBeNull();
    expect(await db.manager.find(ArtifactCommentThread)).toEqual([
      expect.objectContaining({ id: kept.resultId }),
    ]);
    expect(await db.manager.count(ArtifactComment)).toBe(1);
    expect(
      (await db.manager.find(ArtifactCommentReceipt)).map(row => [row.actorId, row.operation]),
    ).toEqual(
      expect.arrayContaining([
        [reader.id, 'dashboard.thread.create'],
        [owner.id, 'thread.create'],
      ]),
    );
    expect(await db.manager.count(ArtifactCommentReceipt)).toBe(2);
    expect((await db.manager.find(ArtifactCommentNotification)).map(row => row.threadId)).toEqual([
      kept.resultId,
    ]);
  });

  it('clears one dashboard in a handover transaction and leaves the rest', async () => {
    const handed = await service.createThread(ANALYSIS, await thread(ANALYSIS), reader);
    await service.reply(ANALYSIS, handed.resultId, reply(), owner);
    const other = await service.createThread(LEGACY, await thread(LEGACY), owner);
    await db.transaction(manager => deleteDashboardComments(manager, 1));
    expect((await db.manager.find(ArtifactCommentThread)).map(row => row.id)).toEqual([
      other.resultId,
    ]);
    expect(await counts()).toEqual({ threads: 1, comments: 1, receipts: 1 });
    expect((await service.list(ANALYSIS, owner)).threads).toEqual([]);
  });

  describe('remote MCP dashboards', () => {
    let mcp: McpDashboardService, assertGrant: jest.Mock;
    const principal = (actor: { id: number }, organizationId = 1) => ({
      actorId: actor.id,
      authVersion: 0,
      grantId: 'grant-1',
      organizationId,
      clientName: 'Claude Code',
      scopes: ['dashboards:read', 'comments:read', 'comments:write'],
    });
    const code = (promise: Promise<unknown>) =>
      promise.then(
        () => 'OK',
        error => mcpError(error).code,
      );
    const add = async (actor: { id: number }, id: string, extra: Record<string, unknown> = {}) =>
      mcp.addComment(
        principal(actor) as any,
        {
          dashboardId: Number(id),
          revision: await revision(id),
          anchor: { kind: 'whole' },
          body: 'From Claude',
          requestId: randomUUID(),
          ...extra,
        } as any,
      );
    beforeEach(() => {
      assertGrant = jest.fn();
      mcp = new McpDashboardService(db, access, service, { assertGrant } as any);
    });

    it('lists only live, ungoverned dashboards of the grant organization that pass the read check, as an allowlist', async () => {
      await db.manager.insert(PersonalLibraryState, {
        userId: owner.id,
        organizationId: 1,
        dashboardId: 2,
        archived: true,
        version: 1,
        updatedAt: new Date(),
      } as any);
      const mine = await mcp.list(principal(owner) as any, 0);
      expect(mine.dashboards.map(row => [row.dashboardId, row.archived])).toEqual([
        [1, false],
        [2, true],
        [3, false],
      ]);
      expect(Object.keys(mine.dashboards[0]).sort()).toEqual(
        ['archived', 'dashboardId', 'title', 'updatedAt'].sort(),
      );
      expect(mine.nextAfterId).toBeNull();
      expect(
        (await mcp.list(principal(reader) as any, 0)).dashboards.map(row => row.dashboardId),
      ).toEqual([1, 2]);
      expect((await mcp.list(principal(otherOrg, 2) as any, 0)).dashboards).toEqual([]);
      expect((await mcp.list(principal(owner, 2) as any, 0)).dashboards).toEqual([]);
      await db.manager.update(Dashboard, 3, { delYn: 'Y' });
      await db.manager.update(Dashboard, 2, { assetActive: false });
      expect(
        (await mcp.list(principal(owner) as any, 0)).dashboards.map(row => row.dashboardId),
      ).toEqual([1]);
    });

    it('pages by the last examined id, so a page emptied by the read check still points onward', async () => {
      // Ids come from the database: PostgreSQL ignores explicit ids on generated columns.
      const ids: number[] = [];
      for (let n = 0; n < 52; n++) {
        const { identifiers } = await db.manager.insert(Dashboard, {
          title: `Extra ${n}`,
          analysisDefinition: definition(ANALYSIS_WIDGETS),
        });
        const id = Number(identifiers[0].id);
        ids.push(id);
        await db.manager.insert(UserMapping, { dashboardId: id, userInfoId: 1 });
        await grant('dashboard', id, outsider.id);
      }
      // The outsider holds dashboard grants but no source grant, so every read check fails.
      const first = await mcp.list(principal(outsider) as any, 0);
      expect(first.dashboards).toEqual([]);
      expect(first.nextAfterId).toBe(ids[49]);
      const last = await mcp.list(principal(outsider) as any, first.nextAfterId);
      expect(last).toEqual({ dashboards: [], nextAfterId: null });
    });

    it('reads structure only: no SQL, business basis, source or data', async () => {
      await db.manager.update(Dashboard, 1, {
        analysisDefinition: JSON.stringify({
          databaseId: 1,
          title: 'Sales',
          explanation: 'Weekly sales overview',
          widgets: [
            {
              ...widget('Revenue', 'BOARD_NUMERIC', 'block-a'),
              description: 'Net revenue',
              categoryField: 'channel',
            },
          ],
        }),
      });
      const outline = await mcp.read(principal(reader) as any, 1);
      expect(outline).toEqual({
        dashboardId: 1,
        title: 'Board 1',
        description: 'Weekly sales overview',
        revision: await revision(ANALYSIS),
        blockAnchors: true,
        blocks: [
          {
            blockId: 'block-a',
            title: 'Revenue',
            description: 'Net revenue',
            type: 'BOARD_NUMERIC',
            valueField: 'value',
            categoryField: 'channel',
          },
        ],
      });
      expect(JSON.stringify(outline)).not.toMatch(/SELECT|PRIVATE_|databaseId|businessBasis|sql/i);
      expect((await mcp.read(principal(owner) as any, 3)).blockAnchors).toBe(false);
      expect(
        (await mcp.read(principal(owner) as any, 2)).blocks.map(block => block.blockId),
      ).toEqual(['legacy-2-0', 'legacy-2-1']);
      for (const attempt of [
        () => mcp.read(principal(owner, 2) as any, 1),
        () => mcp.read(principal(owner) as any, 4),
        () => mcp.read(principal(owner) as any, 999),
        () => mcp.read(principal(otherOrg, 2) as any, 1),
        async () => {
          await db.manager.update(Dashboard, 3, { assetActive: false });
          return mcp.read(principal(owner) as any, 3);
        },
        async () => {
          await db.manager.update(Dashboard, 2, { analysisDefinition: '{not json' });
          return mcp.read(principal(owner) as any, 2);
        },
      ]) {
        const failure = await attempt().then(
          () => null,
          error => mcpError(error),
        );
        expect(failure).toMatchObject({ code: 'FORBIDDEN' });
        expect(failure).not.toHaveProperty('detail');
      }
    });

    it('records AI comments, re-checks both scopes in the transaction and keeps web and MCP requests apart', async () => {
      const created = await add(reader, ANALYSIS, {
        anchor: { kind: 'block', blockId: 'block-b' },
      });
      expect(assertGrant).toHaveBeenCalledWith(expect.anything(), expect.anything(), [
        'dashboards:read',
        'comments:write',
      ]);
      expect(created.thread.author).toEqual({
        kind: 'ai',
        userId: 'user-2',
        clientName: 'Claude Code',
      });
      const row = await db.manager.findOneByOrFail(ArtifactCommentThread, {
        id: created.thread.id,
      });
      expect(row).toMatchObject({
        authorKind: 'ai',
        aiGrantId: 'grant-1',
        aiClientName: 'Claude Code',
      });
      const replied = await mcp.reply(principal(reader) as any, {
        dashboardId: 1,
        threadId: created.thread.id,
        body: 'More context',
        requestId: randomUUID(),
      });
      expect(replied.thread.comments.map(comment => comment.author.kind)).toEqual(['ai', 'ai']);
      const listed = await mcp.threads(principal(reader) as any, 1, 0);
      expect(listed).toMatchObject({ dashboardId: 1, totalThreads: 1, nextThreadOffset: null });
      // The same requestId from the web (no AI provenance) is a different request.
      const requestId = randomUUID();
      await add(reader, ANALYSIS, { requestId });
      expect(
        await code(
          service.createThread(ANALYSIS, { ...(await thread(ANALYSIS)), requestId }, reader),
        ),
      ).toBe('REQUEST_REUSED');
      // A retry with the same input after the dashboard changed returns the recorded result.
      const readRevision = await revision(ANALYSIS);
      const retryId = randomUUID();
      await add(reader, ANALYSIS, { requestId: retryId });
      await redefine(ANALYSIS, [...ANALYSIS_WIDGETS, widget('Margin', 'CHART_LINE', 'block-c')]);
      const retried = await mcp.addComment(principal(reader) as any, {
        dashboardId: 1,
        revision: readRevision,
        anchor: { kind: 'whole' },
        body: 'From Claude',
        requestId: retryId,
      });
      expect(retried.replayed).toBe(true);
      expect(await code(add(reader, ANALYSIS, { revision: '0'.repeat(64) }))).toBe('CONFLICT');
      expect(
        await code(add(owner, PLAIN, { anchor: { kind: 'block', blockId: 'legacy-3-0' } })),
      ).toBe('INVALID');
    });

    it('writes nothing when the grant check fails or the owner moves to another organization before the lock', async () => {
      const before = await counts();
      assertGrant.mockRejectedValueOnce(new UnauthorizedException());
      expect(await code(add(reader, ANALYSIS))).toBe('UNAUTHORIZED');
      // The owner moves to another organization between the grant check and the row lock. The
      // owner still reads the dashboard, so only the organization fence on the locked row refuses.
      assertGrant.mockImplementationOnce(async manager => {
        await manager.update(EnterpriseMembership, { userId: owner.id }, { organizationId: 2 });
      });
      expect(await code(add(owner, ANALYSIS))).toBe('FORBIDDEN');
      expect(await counts()).toEqual(before);
    });

    it('caps open AI threads per dashboard', async () => {
      for (let i = 0; i < 100; i++)
        await db.manager.insert(ArtifactCommentThread, {
          id: randomUUID(),
          artifactKind: 'dashboard',
          artifactId: ANALYSIS,
          version: 0,
          anchorKind: 'whole',
          status: 'open',
          statusVersion: 0,
          createdBy: owner.id,
          authorKind: 'ai',
          createdAt: new Date().toISOString(),
        });
      expect(await code(add(owner, ANALYSIS))).toBe('LIMIT');
      expect(await code(service.createThread(ANALYSIS, await thread(ANALYSIS), owner))).toBe('OK');
    });
  });
});
