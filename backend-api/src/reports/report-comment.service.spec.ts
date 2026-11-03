jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Database } from '../database/entities/database.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioService } from '../dashboard-studio/studio.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { ReportsService } from './reports.service';
import { ReportSharingService } from './report-sharing.service';
import {
  REPORT_ENTITIES,
  PrivateReport,
  PrivateReportRevision,
  PrivateReportChunk,
} from './report.entity';
import { REPORT_SHARING_ENTITIES, ReportDelivery } from './report-sharing.entity';
import {
  REPORT_COMMENT_ENTITIES,
  ArtifactComment,
  ArtifactCommentNotification,
  ArtifactCommentReceipt,
  ArtifactCommentThread,
  ArtifactSuggestion,
} from './report-comment.entity';
import { CommentNotificationService } from './comment-notification.service';
import {
  CommentLimitException,
  isCommentConflict,
  markSuggestionsApplied,
  ReportCommentService,
} from './report-comment.service';
import { documentText, textAnchorAt } from './report-anchor';
import { encodeReport } from './report-contract';

const owner = { id: 7, authVersion: 0 },
  recipient = { id: 8, authVersion: 0 },
  otherRecipient = { id: 11, authVersion: 0 },
  otherOrg = { id: 9, authVersion: 0 },
  inactive = { id: 10, authVersion: 0 };
const id = 'a2345678-1234-4234-8234-123456789abc';
const IMAGE = 'data:image/png;base64,AAAA';
const V1_BLOCKS = [
  { id: 't1', kind: 'TEXT', text: 'Revenue grew 12% in Q3.' },
  { id: 'img1', kind: 'IMAGE', dataUrl: IMAGE, alt: 'chart', width: 'full' },
  { id: 't2', kind: 'TEXT', text: 'Costs fell.' },
];
const V1_TEXT = documentText(V1_BLOCKS, '');
const payload = (reportId: string, version: number, blocks?: unknown[]) => ({
  reportId,
  version,
  title: `Report ${version}`,
  body: `Body ${version}`,
  ...(blocks ? { blocks } : {}),
  savedAt: '2026-10-29T00:00:00Z',
  snapshot: {
    capturedAt: '2026-10-28T00:00:00Z',
    rendered: {
      title: 'PRIVATE_ROOT_TITLE',
      periodLabel: '전체 기간',
      filters: [],
      blocks: [
        {
          id: 'PRIVATE_KPI_ID',
          kind: 'BOARD_NUMERIC',
          title: '매출',
          description: '',
          display: { suffix: 'USD' },
          valueField: 'PRIVATE_NET',
          fields: [{ columnName: 'PRIVATE_NET', columnType: 'number' }],
          datas: [{ PRIVATE_NET: '1' }],
        },
        {
          id: 'PRIVATE_CHART_ID',
          kind: 'CHART_COLUMN',
          title: '채널 매출',
          description: '',
          display: {},
          valueField: 'PRIVATE_NET',
          categoryField: 'PRIVATE_CHANNEL',
          fields: [
            { columnName: 'PRIVATE_NET', columnType: 'number' },
            { columnName: 'PRIVATE_CHANNEL', columnType: 'string' },
          ],
          datas: [{ PRIVATE_NET: 500, PRIVATE_CHANNEL: 'Site' }],
        },
      ],
    },
    basis: {
      timeZone: 'UTC',
      dashboardId: 1,
      source: { id: 1, path: '/PRIVATE_PATH' },
      sql: 'PRIVATE_SQL',
      filters: [],
    },
  },
});

/**
 * Opt-in PostgreSQL run of the same suite in a throwaway schema, e.g.
 * VM_REPORT_COMMENT_POSTGRES_PORT=55491 (also _HOST, _USER, _PASSWORD, _DB).
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
describe(`report comments and suggestions with real ${
  pgPort ? 'PostgreSQL' : 'SQLite'
} transactions`, () => {
  let admin: DataSource | undefined, schema: string | undefined;
  beforeAll(async () => {
    if (pgPort) admin = await new DataSource(pgConnection()).initialize();
  });
  afterAll(async () => {
    await admin?.destroy();
  });
  let db: DataSource,
    sharing: ReportSharingService,
    service: ReportCommentService,
    reports: ReportsService;
  async function revision(version = 1, blocks: unknown[] = V1_BLOCKS) {
    const value = payload(id, version, blocks),
      encoded = encodeReport(value);
    await db.manager.save(PrivateReport, {
      id,
      ownerId: 7,
      organizationKey: 1,
      dashboardId: 1,
      sourceId: 1,
      version,
      revision: encoded.hash,
      title: value.title,
      updatedAt: value.savedAt,
    });
    await db.manager.insert(PrivateReportRevision, {
      reportId: id,
      version,
      ownerId: 7,
      revision: encoded.hash,
      bytes: encoded.bytes,
      chunkCount: encoded.chunks.length,
    });
    for (const [ordinal, chunk] of encoded.chunks.entries())
      await db.manager.insert(PrivateReportChunk, {
        reportId: id,
        version,
        ordinal,
        payload: chunk,
      });
  }
  async function share(recipientId = 8) {
    const relation = await db.manager.findOneBy(ReportDelivery, { reportId: id, recipientId });
    await sharing.change(
      id,
      {
        requestId: randomUUID(),
        expectedOrganizationId: 1,
        recipientId,
        expectedRelationVersion: relation?.relationVersion ?? 0,
        operation: {
          kind: 'share',
          expectedHeadRevision: (await db.manager.findOneByOrFail(PrivateReport, { id })).revision,
        },
      },
      owner,
    );
  }
  async function revoke(recipientId = 8) {
    const relation = await db.manager.findOneByOrFail(ReportDelivery, {
      reportId: id,
      recipientId,
    });
    await sharing.change(
      id,
      {
        requestId: randomUUID(),
        expectedOrganizationId: 1,
        recipientId,
        expectedRelationVersion: relation.relationVersion,
        operation: { kind: 'revoke' },
      },
      owner,
    );
  }
  const text = (version: number, start: number, end: number, source = V1_TEXT) => ({
    anchor: textAnchorAt(source, start, end),
    version,
  });
  const thread = (version: number, anchor: unknown = { kind: 'whole' }, body = 'Looks good') => ({
    requestId: randomUUID(),
    version,
    anchor,
    body,
  });
  const at = (quote: string, source = V1_TEXT) => {
    const start = source.indexOf(quote);
    return textAnchorAt(source, start, start + quote.length);
  };
  const suggestion = (version: number, quote: string, replacement: string, extra = {}) => ({
    requestId: randomUUID(),
    version,
    anchor: at(quote),
    replacement,
    ...extra,
  });
  const counts = async () => ({
    threads: await db.manager.count(ArtifactCommentThread),
    comments: await db.manager.count(ArtifactComment),
    suggestions: await db.manager.count(ArtifactSuggestion),
    receipts: await db.manager.count(ArtifactCommentReceipt),
  });
  const reportRows = () =>
    Promise.all([
      db.manager.find(PrivateReport),
      db.manager.find(PrivateReportRevision),
      db.manager.find(PrivateReportChunk),
    ]);

  beforeEach(async () => {
    if (admin) {
      schema = 'vm_report_comment_' + randomUUID().replace(/-/g, '').slice(0, 16);
      await admin.query(`CREATE SCHEMA "${schema}"`);
    }
    db = await new DataSource({
      ...(admin
        ? { ...pgConnection(), schema, extra: { options: `-c search_path=${schema}` } }
        : { type: 'sqlite' as const, database: ':memory:' }),
      synchronize: true,
      entities: [
        User,
        EnterpriseMembership,
        Dashboard,
        Database,
        UserMapping,
        StudioState,
        ...REPORT_ENTITIES,
        ...REPORT_SHARING_ENTITIES,
        ...REPORT_COMMENT_ENTITIES,
      ],
    }).initialize();
    // PostgreSQL ignores explicit ids on generated columns: start the sequence so users get 7..11.
    if (admin) await db.query(`SELECT setval(pg_get_serial_sequence('"user"', 'id'), 6)`);
    for (const uid of [7, 8, 9, 10, 11]) {
      await db.manager.insert(User, {
        id: uid,
        userId: `user-${uid}`,
        email: `synthetic-${uid}@example.invalid`,
        password: 'synthetic',
        active: uid !== 10,
      });
      await db.manager.insert(EnterpriseMembership, {
        userId: uid,
        organizationId: uid === 9 ? 2 : 1,
        role: 'member',
        team: 'Team',
      });
    }
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 7,
      name: 'PRIVATE_SOURCE',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.manager.insert(Dashboard, {
      id: 1,
      title: 'PRIVATE_DASHBOARD',
      analysisDefinition: JSON.stringify({ databaseId: 1 }),
    });
    await db.manager.insert(UserMapping, { dashboardId: 1, userInfoId: 7 });
    await db.manager.insert(StudioState, {
      dashboardId: 1,
      document: JSON.stringify({ document: { sourceId: 1 } }),
      legacyRevision: 'x',
    });
    await revision();
    const access = new SourceAccessService(db);
    reports = new ReportsService(db, new StudioService(db, null, null, access), access, {
      generate: jest.fn(),
    } as any);
    sharing = new ReportSharingService(db, reports);
    service = new ReportCommentService(db, sharing);
  });
  afterEach(async () => {
    await db.destroy();
    if (admin && schema) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  });

  it('rejects an omitted JWT epoch on every entrypoint without writing', async () => {
    const legacy = { id: 7, authVersion: undefined };
    const tid = randomUUID();
    await expect(service.list(id, legacy)).rejects.toThrow();
    await expect(service.createThread(id, thread(1), legacy)).rejects.toThrow();
    await expect(
      service.reply(id, tid, { requestId: randomUUID(), body: 'x' }, legacy),
    ).rejects.toThrow();
    await expect(
      service.setThreadStatus(
        id,
        tid,
        { requestId: randomUUID(), status: 'resolved', expectedStatusVersion: 0 },
        legacy,
      ),
    ).rejects.toThrow();
    await expect(
      service.createSuggestion(id, suggestion(1, 'grew', 'rose'), legacy),
    ).rejects.toThrow();
    await expect(
      service.dismissSuggestion(
        id,
        tid,
        { requestId: randomUUID(), expectedStatusVersion: 0 },
        legacy,
      ),
    ).rejects.toThrow();
    expect(await counts()).toEqual({ threads: 0, comments: 0, suggestions: 0, receipts: 0 });
  });

  it('lets the owner anchor whole, text and image threads on the head without touching the report', async () => {
    const before = await reportRows();
    const whole = await service.createThread(id, thread(1), owner);
    const range = await service.createThread(id, thread(1, at('grew'), 'Which quarter?'), owner);
    const image = await service.createThread(
      id,
      thread(1, { kind: 'image', blockId: 'img1' }),
      owner,
    );
    expect(whole).toMatchObject({ replayed: false, operation: 'thread.create' });
    expect(range.thread).toMatchObject({
      version: 1,
      anchor: { kind: 'text', start: 8, end: 12, quote: 'grew', prefix: 'Revenue ' },
      location: { status: 'exact', start: 8, end: 12 },
      status: 'open',
      statusVersion: 0,
      author: { kind: 'user', userId: 'user-7', clientName: null },
      mine: true,
      comments: [{ body: 'Which quarter?', author: { userId: 'user-7' }, mine: true }],
      suggestions: [],
    });
    expect(image.thread.location).toEqual({ status: 'exact' });
    const list = await service.list(id, owner);
    expect(list).toMatchObject({ role: 'owner', version: 1 });
    expect(list.threads.map(row => row.id).sort()).toEqual(
      [whole, range, image].map(result => result.thread.id).sort(),
    );
    expect(JSON.stringify(list)).not.toMatch(
      /synthetic-|"createdBy"|"authorId"|"ownerId"|PRIVATE_/,
    );
    expect(await reportRows()).toEqual(before);
  });

  it('rejects invalid anchors and stale versions with 400/409 and no rows', async () => {
    for (const anchor of [
      { ...at('grew'), quote: 'grow' },
      { ...at('grew'), prefix: 'Profit ' },
      { kind: 'text', start: 0, end: 200, quote: 'x', prefix: '', suffix: '' },
    ])
      await expect(service.createThread(id, thread(1, anchor), owner)).rejects.toMatchObject({
        status: 400,
      });
    await expect(
      service.createThread(id, thread(1, { kind: 'image', blockId: 't1' }), owner),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.createThread(id, thread(1, { kind: 'kpi' }), owner)).rejects.toMatchObject(
      {
        status: 400,
      },
    );
    await expect(
      service.createThread(id, thread(1, undefined, '   '), owner),
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.createThread(id, thread(1, undefined, 'NUL \u0000 byte'), owner),
    ).rejects.toMatchObject({ status: 400 });
    const stale = service.createThread(id, thread(2), owner);
    await expect(stale).rejects.toMatchObject({ status: 409 });
    await expect(stale).rejects.not.toBeInstanceOf(CommentLimitException);
    await expect(service.createThread(randomUUID(), thread(1), owner)).rejects.toMatchObject({
      status: 404,
    });
    expect(await counts()).toEqual({ threads: 0, comments: 0, suggestions: 0, receipts: 0 });
  });

  it('pins recipients to their version and shows them only threads they started', async () => {
    await expect(service.list(id, recipient)).rejects.toMatchObject({ status: 403 });
    await expect(service.createThread(id, thread(1), recipient)).rejects.toMatchObject({
      status: 403,
    });
    await share(8);
    await share(11);
    await revision(2, [{ id: 't1', kind: 'TEXT', text: 'Summary. Revenue grew 12% in Q3.' }]);
    const memo = await service.createThread(id, thread(2), owner);
    await expect(service.createThread(id, thread(1), owner)).rejects.toMatchObject({ status: 409 });
    await expect(service.createThread(id, thread(2), recipient)).rejects.toMatchObject({
      status: 409,
    });
    const mine = await service.createThread(id, thread(1, at('Costs'), 'Why?'), recipient);
    expect(mine.thread.location).toEqual({ status: 'exact', start: 25, end: 30 });
    const ownerReply = await service.reply(
      id,
      mine.thread.id,
      { requestId: randomUUID(), body: 'Seasonality.' },
      owner,
    );
    expect(
      ownerReply.thread.comments.map(row => [row.body, row.author.userId, row.mine]).sort(),
    ).toEqual([
      ['Seasonality.', 'user-7', true],
      ['Why?', 'user-8', false],
    ]);
    const seen = await service.list(id, recipient);
    expect(seen).toMatchObject({ role: 'recipient', version: 1 });
    expect(seen.threads.map(row => row.id)).toEqual([mine.thread.id]);
    expect(seen.threads[0].comments.map(row => [row.author.userId, row.mine]).sort()).toEqual([
      ['user-7', false],
      ['user-8', true],
    ]);
    expect(JSON.stringify(seen)).not.toMatch(/synthetic-|"createdBy"|"authorId"|PRIVATE_/);
    // The owner sees the recipient's thread located in the head version.
    const ownerView = await service.list(id, owner);
    expect(ownerView.threads.map(row => row.id).sort()).toEqual(
      [memo.thread.id, mine.thread.id].sort(),
    );
    expect(ownerView.threads.find(row => row.id === mine.thread.id).location).toEqual({
      status: 'detached',
    });
    // Another recipient sees nothing and cannot reach the first recipient's thread.
    expect((await service.list(id, otherRecipient)).threads).toEqual([]);
    // Started one at a time: on PostgreSQL eager promises run concurrently and a later rejection
    // would surface as unhandled before its expect attaches.
    for (const attempt of [
      () =>
        service.reply(id, mine.thread.id, { requestId: randomUUID(), body: 'x' }, otherRecipient),
      () =>
        service.setThreadStatus(
          id,
          mine.thread.id,
          { requestId: randomUUID(), status: 'resolved', expectedStatusVersion: 0 },
          otherRecipient,
        ),
      () =>
        service.createSuggestion(
          id,
          suggestion(1, 'Costs', 'Expenses', { threadId: mine.thread.id }),
          otherRecipient,
        ),
      () => service.reply(id, memo.thread.id, { requestId: randomUUID(), body: 'x' }, recipient),
    ])
      await expect(attempt()).rejects.toMatchObject({ status: 404 });
    // Recipients resolve and reopen their own threads.
    const resolved = await service.setThreadStatus(
      id,
      mine.thread.id,
      { requestId: randomUUID(), status: 'resolved', expectedStatusVersion: 0 },
      recipient,
    );
    expect(resolved.thread).toMatchObject({
      status: 'resolved',
      statusVersion: 1,
      resolvedBy: 'user-8',
    });
  });

  it('hides suggestions above the pinned version from recipients and keeps dismiss owner-only', async () => {
    await share(8);
    const own = await service.createSuggestion(
      id,
      suggestion(1, 'Costs fell.', 'Costs fell 3%.', {
        rationale: 'precision',
        body: 'Add the figure',
      }),
      recipient,
    );
    expect(own.thread).toMatchObject({
      anchor: { kind: 'text', quote: 'Costs fell.' },
      comments: [{ body: 'Add the figure' }],
      suggestions: [
        {
          baseVersion: 1,
          replacement: 'Costs fell 3%.',
          rationale: 'precision',
          status: 'open',
          location: { status: 'exact' },
          author: { kind: 'user', userId: 'user-8' },
        },
      ],
    });
    await revision(2, V1_BLOCKS);
    const ownerSuggestion = await service.createSuggestion(
      id,
      suggestion(2, 'grew', 'rose', { threadId: own.thread.id }),
      owner,
    );
    expect(ownerSuggestion.thread.suggestions).toHaveLength(2);
    const recipientView = await service.list(id, recipient);
    expect(recipientView.threads[0].suggestions.map(row => row.id)).toEqual([own.resultId]);
    await expect(
      service.dismissSuggestion(
        id,
        own.resultId,
        { requestId: randomUUID(), expectedStatusVersion: 0 },
        recipient,
      ),
    ).rejects.toMatchObject({ status: 403 });
    const dismissed = await service.dismissSuggestion(
      id,
      own.resultId,
      { requestId: randomUUID(), expectedStatusVersion: 0 },
      owner,
    );
    expect(dismissed.thread.suggestions.find(row => row.id === own.resultId)).toMatchObject({
      status: 'dismissed',
      statusVersion: 1,
    });
    expect(dismissed.thread.status).toBe('open');
    await expect(
      service.dismissSuggestion(
        id,
        own.resultId,
        { requestId: randomUUID(), expectedStatusVersion: 1 },
        owner,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.dismissSuggestion(
        id,
        randomUUID(),
        { requestId: randomUUID(), expectedStatusVersion: 0 },
        owner,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('denies revoked, departed, epoch-bumped, other-org, inactive and broken-pin actors on every read and write', async () => {
    await share(8);
    const mine = await service.createThread(id, thread(1), recipient);
    const write = (actor: typeof recipient) =>
      service.reply(id, mine.thread.id, { requestId: randomUUID(), body: 'again' }, actor);
    for (const actor of [otherOrg, inactive]) {
      await expect(service.list(id, actor)).rejects.toMatchObject({ status: 403 });
      await expect(service.createThread(id, thread(1), actor)).rejects.toMatchObject({
        status: 403,
      });
    }
    // Epoch bump (login reset / departure): the old token is 401, a new token is 403 until reshare.
    await db.manager.update(User, 8, { authVersion: 1 });
    await expect(service.list(id, recipient)).rejects.toMatchObject({ status: 401 });
    await expect(write({ ...recipient, authVersion: 1 })).rejects.toMatchObject({ status: 403 });
    await db.manager.update(User, 8, { authVersion: 0 });
    expect((await write(recipient)).thread.comments).toHaveLength(2);
    // Departure removes the membership while the delivery row stays active.
    await db.manager.delete(EnterpriseMembership, { userId: 8 });
    await expect(service.list(id, recipient)).rejects.toMatchObject({ status: 403 });
    await expect(write(recipient)).rejects.toMatchObject({ status: 403 });
    await db.manager.insert(EnterpriseMembership, {
      userId: 8,
      organizationId: 1,
      role: 'member',
      team: 'Team',
    });
    // A pinned hash that no longer matches the stored revision is denied by access().
    await db.manager.update(
      ReportDelivery,
      { reportId: id, recipientId: 8 },
      { pinnedHash: 'f'.repeat(64) },
    );
    await expect(service.list(id, recipient)).rejects.toMatchObject({ status: 403 });
    await expect(sharing.reader(id, recipient)).rejects.toMatchObject({ status: 403 });
    await share(8);
    expect((await service.list(id, recipient)).threads).toHaveLength(1);
    // Revocation hides everything; the rows stay for the owner.
    await revoke(8);
    await expect(service.list(id, recipient)).rejects.toMatchObject({ status: 403 });
    await expect(write(recipient)).rejects.toMatchObject({ status: 403 });
    expect((await service.list(id, owner)).threads).toHaveLength(1);
    expect(await db.manager.count(ArtifactComment)).toBe(2);
  });

  it('replays the same request, rejects a changed payload with 409 and re-checks access first', async () => {
    await share(8);
    const command = thread(1, at('grew'), 'First');
    const first = await service.createThread(id, command, recipient);
    const again = await service.createThread(id, command, recipient);
    expect(again).toMatchObject({ replayed: true, resultId: first.resultId });
    expect(again.thread.id).toBe(first.thread.id);
    expect(await counts()).toEqual({ threads: 1, comments: 1, suggestions: 0, receipts: 1 });
    await expect(
      service.createThread(id, { ...command, body: 'Changed' }, recipient),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.reply(
        id,
        first.thread.id,
        { requestId: command.requestId, body: 'First' },
        recipient,
      ),
    ).rejects.toMatchObject({ status: 409 });
    // Request ids are scoped per actor: the owner may reuse it.
    expect((await service.createThread(id, command, owner)).replayed).toBe(false);
    const reply = { requestId: randomUUID(), body: 'Reply' };
    const replied = await service.reply(id, first.thread.id, reply, recipient);
    expect((await service.reply(id, first.thread.id, reply, recipient)).resultId).toBe(
      replied.resultId,
    );
    const proposal = suggestion(1, 'grew', 'rose', { threadId: first.thread.id });
    const proposed = await service.createSuggestion(id, proposal, recipient);
    expect(await service.createSuggestion(id, proposal, recipient)).toMatchObject({
      replayed: true,
      resultId: proposed.resultId,
    });
    expect(await counts()).toEqual({ threads: 2, comments: 3, suggestions: 1, receipts: 4 });
    // replay() reads the committed result exactly as a replaying write builds it, and writes nothing.
    expect(await service.replay(id, command.requestId, recipient)).toEqual(
      await service.createThread(id, command, recipient),
    );
    expect(await service.replay(id, proposal.requestId, recipient)).toEqual(
      await service.createSuggestion(id, proposal, recipient),
    );
    expect(await service.replay(id, randomUUID(), recipient)).toBeNull();
    expect((await service.replay(id, command.requestId, owner))?.resultId).not.toBe(first.resultId);
    expect(await counts()).toEqual({ threads: 2, comments: 3, suggestions: 1, receipts: 4 });
    await revoke(8);
    await expect(service.createThread(id, command, recipient)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.replay(id, command.requestId, recipient)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('rejects a dashboard requestId on report routes without exposing the dashboard thread', async () => {
    const dashboardThread = randomUUID();
    await db.manager.insert(ArtifactCommentThread, {
      id: dashboardThread,
      artifactKind: 'dashboard',
      artifactId: '6',
      version: 0,
      anchorKind: 'whole',
      status: 'open',
      statusVersion: 0,
      createdBy: owner.id,
      authorKind: 'user',
      createdAt: new Date().toISOString(),
    });
    const requestId = randomUUID();
    await db.manager.insert(ArtifactCommentReceipt, {
      actorId: owner.id,
      organizationKey: 1,
      requestId,
      operation: 'dashboard.thread.create',
      payloadHash: 'f'.repeat(64),
      resultId: dashboardThread,
      createdAt: new Date().toISOString(),
    });
    const before = await counts();
    const command = { ...thread(1), requestId };
    await expect(service.createThread(id, command, owner)).rejects.toMatchObject({
      status: 409,
      code: 'REQUEST_REUSED',
    });
    await expect(
      service.createThread(id, command, owner).catch(error => error.getResponse()),
    ).resolves.not.toHaveProperty('threadId');
    expect(await counts()).toEqual(before);
  });

  it('applies statusVersion CAS to resolve and reopen', async () => {
    const created = await service.createThread(id, thread(1), owner);
    const tid = created.thread.id;
    const status = (value: string, expectedStatusVersion: number) => ({
      requestId: randomUUID(),
      status: value,
      expectedStatusVersion,
    });
    const resolved = await service.setThreadStatus(id, tid, status('resolved', 0), owner);
    expect(resolved.thread).toMatchObject({
      status: 'resolved',
      statusVersion: 1,
      resolvedBy: 'user-7',
    });
    expect(resolved.thread.resolvedAt).toEqual(expect.any(String));
    await expect(service.setThreadStatus(id, tid, status('open', 0), owner)).rejects.toMatchObject({
      status: 409,
    });
    const unchanged = await service.setThreadStatus(id, tid, status('resolved', 1), owner);
    expect(unchanged.thread.statusVersion).toBe(1);
    await expect(
      service.createSuggestion(id, suggestion(1, 'grew', 'rose', { threadId: tid }), owner),
    ).rejects.toMatchObject({ status: 409 });
    const reopened = await service.setThreadStatus(id, tid, status('open', 1), owner);
    expect(reopened.thread).toMatchObject({
      status: 'open',
      statusVersion: 2,
      resolvedBy: null,
      resolvedAt: null,
    });
    await expect(
      service.setThreadStatus(id, randomUUID(), status('open', 0), owner),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('enforces thread, comment, suggestion, AI and text limits', async () => {
    const base = {
      artifactKind: 'report',
      artifactId: id,
      version: 1,
      anchorKind: 'whole',
      status: 'open',
      statusVersion: 0,
      createdBy: 7,
      createdAt: '2026-11-01T00:00:00.000Z',
    };
    const ai = { ai: { grantId: 'grant-1', clientName: 'Claude' } };
    const aiRows = Array.from({ length: 100 }, () => ({
      ...base,
      id: randomUUID(),
      authorKind: 'ai',
    }));
    await db.manager.insert(ArtifactCommentThread, aiRows);
    await expect(service.createThread(id, thread(1), owner, ai)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      service.createSuggestion(id, suggestion(1, 'grew', 'rose'), owner, ai),
    ).rejects.toMatchObject({ status: 409, code: 'COMMENT_LIMIT' });
    const human = await service.createThread(id, thread(1, undefined, 'first'), owner);
    const filler = Array.from({ length: 199 }, () => ({
      id: randomUUID(),
      threadId: human.thread.id,
      authorId: 7,
      authorKind: 'user',
      body: 'x',
      createdAt: base.createdAt,
    }));
    for (let i = 0; i < filler.length; i += 50)
      await db.manager.insert(ArtifactComment, filler.slice(i, i + 50));
    await expect(
      service.reply(id, human.thread.id, { requestId: randomUUID(), body: 'one more' }, owner),
    ).rejects.toMatchObject({ status: 409, code: 'COMMENT_LIMIT' });
    const users = Array.from({ length: 399 }, () => ({
      ...base,
      id: randomUUID(),
      authorKind: 'user',
    }));
    for (let i = 0; i < users.length; i += 50)
      await db.manager.insert(ArtifactCommentThread, users.slice(i, i + 50));
    await expect(service.createThread(id, thread(1), owner)).rejects.toMatchObject({
      status: 409,
      code: 'COMMENT_LIMIT',
    });
    expect(await db.manager.count(ArtifactCommentThread)).toBe(500);
  });

  it('limits open suggestions to 100 and stored text to 2 MiB (UTF-8 bytes)', async () => {
    const created = await service.createThread(id, thread(1, undefined, 'first'), owner);
    const tid = created.thread.id;
    const rows = Array.from({ length: 100 }, () => ({
      id: randomUUID(),
      threadId: tid,
      artifactId: id,
      baseVersion: 1,
      anchorStart: 8,
      anchorEnd: 12,
      anchorQuote: 'grew',
      anchorPrefix: '',
      anchorSuffix: '',
      replacement: 'rose',
      status: 'open',
      statusVersion: 0,
      createdBy: 7,
      authorKind: 'user',
      createdAt: '2026-11-01T00:00:00.000Z',
    }));
    for (let i = 0; i < rows.length; i += 25)
      await db.manager.insert(ArtifactSuggestion, rows.slice(i, i + 25));
    await expect(
      service.createSuggestion(id, suggestion(1, 'grew', 'rose', { threadId: tid }), owner),
    ).rejects.toMatchObject({ status: 409, code: 'COMMENT_LIMIT' });
    await db.manager.update(ArtifactSuggestion, { threadId: tid }, { status: 'dismissed' });
    // 'first' (5) + 100 x 'rose' (400) + filler + reply must stay within 2 MiB.
    const room = 2 * 1024 * 1024 - 5 - 400;
    await db.manager.insert(ArtifactComment, {
      id: randomUUID(),
      threadId: tid,
      authorId: 7,
      authorKind: 'user',
      body: '가'.repeat(Math.floor((room - 6) / 3)) + 'x'.repeat((room - 6) % 3),
      createdAt: '2026-11-01T00:00:00.000Z',
    });
    await expect(
      service.reply(id, tid, { requestId: randomUUID(), body: '가가x' }, owner),
    ).rejects.toMatchObject({ status: 409, code: 'COMMENT_LIMIT' });
    expect(
      (await service.reply(id, tid, { requestId: randomUUID(), body: '가가' }, owner)).replayed,
    ).toBe(false);
  });

  it('rejects suggestions that change nothing or push the document past 20,000 units', async () => {
    const long = 'a'.repeat(19990) + ' tail';
    await revision(2, [{ id: 't1', kind: 'TEXT', text: long }]);
    const anchor = textAnchorAt(long, 19990, 19995);
    const propose = (replacement: string) =>
      service.createSuggestion(
        id,
        { requestId: randomUUID(), version: 2, anchor, replacement },
        owner,
      );
    await expect(propose(' tail')).rejects.toMatchObject({ status: 400 });
    await expect(propose('x'.repeat(11))).rejects.toMatchObject({
      status: 413,
      code: 'COMMENT_LIMIT',
    });
    const ok = await propose('x'.repeat(10));
    expect(ok.thread).toMatchObject({
      anchor: { kind: 'text', quote: ' tail' },
      comments: [],
      suggestions: [{ replacement: 'x'.repeat(10), baseVersion: 2 }],
    });
    expect(await counts()).toMatchObject({ threads: 1, suggestions: 1 });
  });

  it('locates v1 anchors in the owner head after edits (moved/detached)', async () => {
    const range = await service.createThread(id, thread(1, at('grew')), owner);
    const gone = await service.createThread(id, thread(1, at('Costs')), owner);
    const image = await service.createThread(
      id,
      thread(1, { kind: 'image', blockId: 'img1' }),
      owner,
    );
    const proposal = await service.createSuggestion(id, suggestion(1, 'grew', 'rose'), owner);
    await revision(2, [{ id: 't1', kind: 'TEXT', text: 'Summary. Revenue grew 12% in Q3.' }]);
    const view = new Map((await service.list(id, owner)).threads.map(row => [row.id, row]));
    expect(view.get(range.thread.id).location).toEqual({ status: 'moved', start: 17, end: 21 });
    expect(view.get(gone.thread.id).location).toEqual({ status: 'detached' });
    expect(view.get(image.thread.id).location).toEqual({ status: 'detached' });
    expect(view.get(proposal.thread.id).suggestions[0].location).toEqual({
      status: 'moved',
      start: 17,
      end: 21,
    });
  });

  it('runs the MCP hook inside the write transaction and records AI provenance in author and hash', async () => {
    const seen: boolean[] = [];
    const hook = jest.fn(async (manager: EntityManager) => {
      seen.push(manager.queryRunner?.isTransactionActive === true);
    });
    const command = thread(1, at('grew'), 'Consider "rose".');
    const ai = { grantId: 'grant-1', clientName: 'Claude Desktop' };
    const created = await service.createThread(id, command, owner, { beforeAccess: hook, ai });
    expect(seen).toEqual([true]);
    expect(created.thread.author).toEqual({
      kind: 'ai',
      userId: 'user-7',
      clientName: 'Claude Desktop',
    });
    expect(created.thread.comments[0].author).toEqual({
      kind: 'ai',
      userId: 'user-7',
      clientName: 'Claude Desktop',
    });
    expect(
      await db.manager.findOneByOrFail(ArtifactCommentThread, { id: created.thread.id }),
    ).toMatchObject({
      authorKind: 'ai',
      aiGrantId: 'grant-1',
      aiClientName: 'Claude Desktop',
    });
    await expect(service.createThread(id, command, owner)).rejects.toMatchObject({ status: 409 });
    expect((await service.createThread(id, command, owner, { ai })).replayed).toBe(true);
    const revoked = jest.fn(async () => {
      throw new Error('grant revoked');
    });
    await expect(
      service.createSuggestion(id, suggestion(1, 'grew', 'rose'), owner, {
        beforeAccess: revoked,
        ai,
      }),
    ).rejects.toThrow('grant revoked');
    await expect(
      service.createThread(id, thread(1), owner, { ai: { grantId: '', clientName: 'x' } }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await counts()).toEqual({ threads: 1, comments: 1, suggestions: 0, receipts: 1 });
  });

  it('maps lock, serialization and unique failures to 409 without rows', async () => {
    const failure = (code: string) =>
      new QueryFailedError('synthetic', [], Object.assign(new Error('contention'), { code }));
    for (const code of ['23505', '40001', '40P01', '55P03', 'SQLITE_BUSY', 'SQLITE_LOCKED'])
      expect(isCommentConflict(failure(code))).toBe(true);
    for (const code of ['SQLITE_ERROR', 'SQLITE_CONSTRAINT', 'SQLITE_IOERR', '22021', '23503'])
      expect(isCommentConflict(failure(code))).toBe(false);
    expect(isCommentConflict(new Error('23505'))).toBe(false);
    const insert = EntityManager.prototype.insert;
    const spy = jest
      .spyOn(EntityManager.prototype, 'insert')
      .mockImplementation(function (target, value) {
        if (target === ArtifactCommentReceipt) throw failure('23505');
        return insert.call(this, target, value);
      });
    const command = thread(1);
    try {
      await expect(service.createThread(id, command, owner)).rejects.toMatchObject({ status: 409 });
    } finally {
      spy.mockRestore();
    }
    expect(await counts()).toEqual({ threads: 0, comments: 0, suggestions: 0, receipts: 0 });
    expect((await service.createThread(id, command, owner)).replayed).toBe(false);
  });

  it('markSuggestionsApplied applies only open older suggestions and resolves emptied threads', async () => {
    const first = await service.createSuggestion(id, suggestion(1, 'grew', 'rose'), owner);
    const tid = first.thread.id;
    const second = await service.createSuggestion(
      id,
      suggestion(1, 'Costs', 'Expenses', { threadId: tid }),
      owner,
    );
    const other = await service.createSuggestion(id, suggestion(1, 'Q3', 'third quarter'), owner);
    const dismissed = await service.createSuggestion(
      id,
      suggestion(1, 'fell', 'dropped', { threadId: other.thread.id }),
      owner,
    );
    await service.dismissSuggestion(
      id,
      dismissed.resultId,
      { requestId: randomUUID(), expectedStatusVersion: 0 },
      owner,
    );
    await revision(2, V1_BLOCKS);
    // Not newer than the base: skipped.
    expect(
      await db.transaction(manager =>
        markSuggestionsApplied(manager, {
          reportId: id,
          newVersion: 1,
          ids: [first.resultId],
          decidedBy: 7,
        }),
      ),
    ).toEqual([]);
    const ids = [first.resultId, second.resultId, dismissed.resultId, randomUUID(), first.resultId];
    const applied = await db.transaction(manager =>
      markSuggestionsApplied(manager, { reportId: id, newVersion: 2, ids, decidedBy: 7 }),
    );
    expect(applied).toEqual([first.resultId, second.resultId].sort());
    expect(
      await db.transaction(manager =>
        markSuggestionsApplied(manager, { reportId: id, newVersion: 2, ids, decidedBy: 7 }),
      ),
    ).toEqual(applied);
    expect(
      await db.transaction(manager =>
        markSuggestionsApplied(manager, {
          reportId: randomUUID(),
          newVersion: 3,
          ids: [other.resultId],
          decidedBy: 7,
        }),
      ),
    ).toEqual([]);
    const view = new Map((await service.list(id, owner)).threads.map(row => [row.id, row]));
    expect(view.get(tid)).toMatchObject({
      status: 'resolved',
      statusVersion: 1,
      resolvedBy: 'user-7',
    });
    expect(
      view.get(tid).suggestions.map(row => [row.status, row.appliedVersion, row.statusVersion]),
    ).toEqual([
      ['applied', 2, 1],
      ['applied', 2, 1],
    ]);
    // A thread with an open suggestion left stays open; the dismissed one is untouched.
    expect(view.get(other.thread.id)).toMatchObject({ status: 'open' });
    expect(
      view
        .get(other.thread.id)
        .suggestions.map(row => row.status)
        .sort(),
    ).toEqual(['dismissed', 'open']);
  });

  describe('comment notifications', () => {
    let notifications: CommentNotificationService;
    beforeEach(() => {
      notifications = new CommentNotificationService(db, sharing);
    });
    const events = async (actor: typeof owner) =>
      (await notifications.list(actor)).items.map(item => item.event).sort();
    const unread = async (actor: typeof owner) => (await notifications.unreadCount(actor)).count;
    const rows = () =>
      db.manager.find(ArtifactCommentNotification, { order: { createdAt: 'ASC' } });
    const status = (statusValue: 'open' | 'resolved', expectedStatusVersion: number) => ({
      requestId: randomUUID(),
      status: statusValue,
      expectedStatusVersion,
    });

    it('notifies the owner and the thread author, never the person acting, and never on replay or no-op', async () => {
      await share(8);
      await share(11);
      const command = thread(1);
      const created = await service.createThread(id, command, recipient);
      expect(await events(owner)).toEqual(['thread.created']);
      expect(await events(recipient)).toEqual([]);
      expect((await service.createThread(id, command, recipient)).replayed).toBe(true);
      expect(await rows()).toHaveLength(1);
      const tid = created.thread.id;
      await service.reply(id, tid, { requestId: randomUUID(), body: 'Thanks' }, owner);
      await service.setThreadStatus(id, tid, status('resolved', 0), owner);
      await service.setThreadStatus(id, tid, status('resolved', 1), owner);
      expect(await events(recipient)).toEqual(['comment.replied', 'thread.resolved']);
      expect(await events(owner)).toEqual(['thread.created']);
      expect(await events(otherRecipient)).toEqual([]);
      const latest = (await notifications.list(recipient)).items.find(
        item => item.event === 'comment.replied',
      );
      expect(latest).toMatchObject({
        reportId: id,
        threadId: tid,
        role: 'recipient',
        title: 'Report 1',
        actor: { kind: 'user', userId: 'user-7', clientName: null },
        read: false,
      });
      expect(JSON.stringify(await notifications.list(recipient))).not.toContain('Thanks');
    });

    it('notifies the grant user of their own AI comment and rolls back with the write', async () => {
      const ai = { grantId: 'grant-1', clientName: 'Claude Code' };
      await service.createThread(id, thread(1), owner, { ai });
      const [item] = (await notifications.list(owner)).items;
      expect(item).toMatchObject({
        event: 'thread.created',
        role: 'owner',
        actor: { kind: 'ai', userId: null, clientName: 'Claude Code' },
      });
      // Fail the receipt insert, which runs after perform() has written the notification.
      const insert = EntityManager.prototype.insert;
      const spy = jest
        .spyOn(EntityManager.prototype, 'insert')
        .mockImplementation(function (this: EntityManager, target: unknown, ...rest: unknown[]) {
          if (target === ArtifactCommentReceipt) throw new Error('receipt failed');
          return (insert as (...args: unknown[]) => unknown).call(this, target, ...rest) as never;
        });
      try {
        await expect(service.createThread(id, thread(1), owner, { ai })).rejects.toThrow(
          'receipt failed',
        );
      } finally {
        spy.mockRestore();
      }
      expect(await rows()).toHaveLength(1);
      expect(await db.manager.count(ArtifactCommentThread)).toBe(1);
    });

    it('shows recipients their pinned title, keeps rows across re-shares and hides them after epoch change, org move and revoke', async () => {
      await share(8);
      const tid = (await service.createThread(id, thread(1), recipient)).thread.id;
      await service.reply(id, tid, { requestId: randomUUID(), body: 'Seen' }, owner);
      await revision(2, V1_BLOCKS);
      expect((await notifications.list(owner)).items[0].title).toBe('Report 2');
      expect((await notifications.list(recipient)).items[0].title).toBe('Report 1');
      expect(await unread(recipient)).toBe(1);
      // Re-sharing a newer version to an active recipient keeps their notifications.
      await share(8);
      expect((await notifications.list(recipient)).items[0].title).toBe('Report 2');
      expect(await unread(recipient)).toBe(1);

      await db.manager.update(User, 8, { authVersion: 1 });
      expect(await events({ ...recipient, authVersion: 1 })).toEqual([]);
      expect(await unread({ ...recipient, authVersion: 1 })).toBe(0);
      await db.manager.update(User, 8, { authVersion: 0 });
      expect(await unread(recipient)).toBe(1);

      await db.manager.update(EnterpriseMembership, { userId: 8 }, { organizationId: 2 });
      expect(await unread(recipient)).toBe(0);
      await db.manager.update(EnterpriseMembership, { userId: 8 }, { organizationId: 1 });

      await revoke(8);
      expect(await unread(recipient)).toBe(0);
      await share(8);
      expect(await events(recipient)).toEqual([]);
      expect(await unread(recipient)).toBe(0);
      await service.reply(id, tid, { requestId: randomUUID(), body: 'Again' }, owner);
      expect(await events(recipient)).toEqual(['comment.replied']);
      expect(await rows()).toHaveLength(3);
    });

    it('hides rows from before an auth reset once the owner re-shares, and shows new ones', async () => {
      await share(8);
      const tid = (await service.createThread(id, thread(1), recipient)).thread.id;
      await service.reply(id, tid, { requestId: randomUUID(), body: 'Before' }, owner);
      await db.manager.update(User, 8, { authVersion: 1 });
      const reset = { ...recipient, authVersion: 1 };
      await share(8);
      expect(await events(reset)).toEqual([]);
      await service.reply(id, tid, { requestId: randomUUID(), body: 'After' }, owner);
      expect(await events(reset)).toEqual(['comment.replied']);
      expect(await unread(reset)).toBe(1);

      await db.manager.update(User, 7, { authVersion: 1 });
      const ownerReset = { ...owner, authVersion: 1 };
      await sharing.change(
        id,
        {
          requestId: randomUUID(),
          expectedOrganizationId: 1,
          recipientId: 8,
          expectedRelationVersion: (
            await db.manager.findOneByOrFail(ReportDelivery, { reportId: id, recipientId: 8 })
          ).relationVersion,
          operation: {
            kind: 'share',
            expectedHeadRevision: (
              await db.manager.findOneByOrFail(PrivateReport, { id })
            ).revision,
          },
        },
        ownerReset,
      );
      expect(await unread(reset)).toBe(0);
    });

    it('notifies suggestion applied once per thread and suggestion dismissed', async () => {
      await share(8);
      const first = await service.createSuggestion(id, suggestion(1, 'grew', 'rose'), recipient);
      const tid = first.thread.id;
      const second = await service.createSuggestion(
        id,
        suggestion(1, 'Costs', 'Expenses', { threadId: tid }),
        recipient,
      );
      const third = await service.createSuggestion(
        id,
        suggestion(1, 'fell', 'dropped', { threadId: tid }),
        recipient,
      );
      expect(await events(owner)).toEqual([
        'suggestion.created',
        'suggestion.created',
        'suggestion.created',
      ]);
      await service.dismissSuggestion(
        id,
        third.resultId,
        { requestId: randomUUID(), expectedStatusVersion: 0 },
        owner,
      );
      await revision(2, V1_BLOCKS);
      await db.transaction(manager =>
        markSuggestionsApplied(manager, {
          reportId: id,
          newVersion: 2,
          ids: [first.resultId, second.resultId],
          decidedBy: 7,
        }),
      );
      expect(await events(recipient)).toEqual(['suggestion.applied', 'suggestion.dismissed']);
      expect(await events(owner)).toHaveLength(3);
    });

    it("marks only the caller's own rows read", async () => {
      await share(8);
      const tid = (await service.createThread(id, thread(1), recipient)).thread.id;
      await service.reply(id, tid, { requestId: randomUUID(), body: 'One' }, owner);
      await service.reply(id, tid, { requestId: randomUUID(), body: 'Two' }, owner);
      const ids = (await notifications.list(recipient)).items.map(item => item.id);
      expect(await notifications.markRead(owner, { ids })).toEqual({ updated: 0 });
      expect(await unread(recipient)).toBe(2);
      expect(await notifications.markRead(recipient, { ids: [ids[0]] })).toEqual({ updated: 1 });
      expect(await unread(recipient)).toBe(1);
      expect(await notifications.markRead(recipient, { all: true })).toEqual({ updated: 1 });
      expect(await unread(recipient)).toBe(0);
      expect(await unread(owner)).toBe(1);
      await expect(notifications.markRead(recipient, { ids: ['x'] })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('pages newest first and trims rows older than 90 days or past the newest 500', async () => {
      const tid = (await service.createThread(id, thread(1), owner)).thread.id;
      const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 0, minute)).toISOString();
      const row = (createdAt: string) => ({
        id: randomUUID(),
        recipientId: 7,
        organizationKey: 1,
        artifactKind: 'report',
        artifactId: id,
        threadId: tid,
        event: 'comment.replied',
        actorKind: 'user',
        actorId: 8,
        aiClientName: null,
        relationVersion: null,
        createdAt,
        readAt: null,
      });
      await db.manager.insert(ArtifactCommentNotification, [
        ...Array.from({ length: 25 }, (_, minute) => row(at(minute))),
        row('2020-01-01T00:00:00.000Z'),
      ]);
      const first = await notifications.list(owner);
      expect(first.items).toHaveLength(20);
      expect(first.items[0].createdAt).toBe(at(24));
      const second = await notifications.list(owner, first.nextCursor!);
      expect(second.items.map(item => item.createdAt)).toEqual([4, 3, 2, 1, 0].map(at));
      expect(second.nextCursor).toBeNull();
      expect(await db.manager.countBy(ArtifactCommentNotification, { recipientId: 7 })).toBe(25);
      await expect(notifications.list(owner, randomUUID())).rejects.toMatchObject({ status: 400 });

      await db.manager.insert(
        ArtifactCommentNotification,
        Array.from({ length: 480 }, (_, i) =>
          row(new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString()),
        ),
      );
      await notifications.list(owner);
      expect(await db.manager.countBy(ArtifactCommentNotification, { recipientId: 7 })).toBe(500);
      expect(
        (await db.manager.findOneByOrFail(ArtifactCommentNotification, { createdAt: at(24) })).id,
      ).toBeDefined();
    });
  });

  describe('shared threads', () => {
    let notifications: CommentNotificationService;
    beforeEach(() => {
      notifications = new CommentNotificationService(db, sharing);
    });
    const ai = { grantId: 'grant-1', clientName: 'Claude Code' };
    const events = async (actor: typeof owner) =>
      (await notifications.list(actor)).items.map(item => item.event).sort();
    const visibility = (value: 'private' | 'participants') => ({
      requestId: randomUUID(),
      visibility: value,
    });
    const shared = (version: number, anchor: unknown = { kind: 'whole' }, body = 'Team check') => ({
      ...thread(version, anchor, body),
      visibility: 'participants',
    });
    const ids = async (actor: typeof owner) =>
      (await service.list(id, actor)).threads.map(row => row.id);

    it('shows a participants thread to recipients pinned at or after it, who may only reply', async () => {
      await share(8);
      await share(11);
      const open = await service.createThread(id, shared(1), owner);
      expect(open.thread).toMatchObject({
        visibility: 'participants',
        canManage: true,
        narrowLocked: false,
        viewerCount: 2,
      });
      expect(await events(recipient)).toEqual(['thread.created']);
      expect(await events(otherRecipient)).toEqual(['thread.created']);
      const [seen] = (await service.list(id, otherRecipient)).threads;
      expect(seen).toMatchObject({ id: open.thread.id, canManage: false, viewerCount: null });
      const command = { requestId: randomUUID(), body: 'Agreed' };
      const reply = await service.reply(id, open.thread.id, command, otherRecipient);
      expect(reply.thread.id).toBe(open.thread.id);
      expect((await service.reply(id, open.thread.id, command, otherRecipient)).replayed).toBe(
        true,
      );
      for (const attempt of [
        () =>
          service.setThreadStatus(
            id,
            open.thread.id,
            { requestId: randomUUID(), status: 'resolved', expectedStatusVersion: 0 },
            otherRecipient,
          ),
        () =>
          service.createSuggestion(
            id,
            suggestion(1, 'Costs', 'Expenses', { threadId: open.thread.id }),
            otherRecipient,
          ),
        () =>
          service.setThreadVisibility(id, open.thread.id, visibility('private'), otherRecipient),
      ])
        await expect(attempt()).rejects.toMatchObject({ status: 403 });
      // A participants thread newer than a recipient's pin stays hidden, even by id.
      await revision(2, [{ id: 't1', kind: 'TEXT', text: 'Summary. Revenue grew 12% in Q3.' }]);
      const newer = await service.createThread(id, shared(2), owner);
      expect(newer.thread.viewerCount).toBe(0);
      expect(await ids(recipient)).toEqual([open.thread.id]);
      await expect(
        service.reply(id, newer.thread.id, { requestId: randomUUID(), body: 'x' }, recipient),
      ).rejects.toMatchObject({ status: 404 });
      expect(await events(recipient)).toEqual(['thread.created']);
      // Re-sharing the newer version reveals it and says so; others are untouched.
      await share(8);
      expect((await ids(recipient)).sort()).toEqual([open.thread.id, newer.thread.id].sort());
      expect(await events(recipient)).toEqual(
        ['thread.created', 'thread.shared'],
      );
      expect(await events(otherRecipient)).toEqual(['thread.created']);
      expect(
        (await service.list(id, owner)).threads.find(row => row.id === newer.thread.id),
      ).toMatchObject({ viewerCount: 1 });
    });

    it('lets only the author widen, the author or owner narrow until someone else replies, and never an AI', async () => {
      await share(8);
      await share(11);
      await expect(service.createThread(id, shared(1), recipient, { ai })).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        service.createSuggestion(
          id,
          suggestion(1, 'Costs', 'Expenses', { visibility: 'participants' }),
          recipient,
          { ai },
        ),
      ).rejects.toMatchObject({ status: 403 });
      const mine = await service.createThread(id, thread(1), recipient);
      expect(mine.thread).toMatchObject({ visibility: 'private', viewerCount: 1 });
      const tid = mine.thread.id;
      await expect(
        service.setThreadVisibility(id, tid, visibility('participants'), owner),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.setThreadVisibility(id, tid, visibility('participants'), recipient, { ai }),
      ).rejects.toMatchObject({ status: 403 });
      const widen = visibility('participants');
      expect((await service.setThreadVisibility(id, tid, widen, recipient)).thread.visibility).toBe(
        'participants',
      );
      expect((await service.setThreadVisibility(id, tid, widen, recipient)).replayed).toBe(true);
      await service.setThreadVisibility(id, tid, visibility('participants'), recipient);
      expect(await events(otherRecipient)).toEqual(['thread.shared']);
      // Replies by the owner, the author and their AIs keep the thread narrowable.
      await service.reply(id, tid, { requestId: randomUUID(), body: 'Owner AI' }, owner, { ai });
      await service.reply(id, tid, { requestId: randomUUID(), body: 'Author AI' }, recipient, {
        ai,
      });
      await service.setThreadVisibility(id, tid, visibility('private'), owner);
      await service.setThreadVisibility(id, tid, visibility('participants'), recipient);
      await service.reply(id, tid, { requestId: randomUUID(), body: 'Other AI' }, otherRecipient, {
        ai,
      });
      expect((await service.list(id, recipient)).threads[0].narrowLocked).toBe(true);
      for (const actor of [recipient, owner])
        await expect(
          service.setThreadVisibility(id, tid, visibility('private'), actor),
        ).rejects.toMatchObject({ status: 409 });
    });

    it('hides a narrowed thread and its notifications from other recipients', async () => {
      await share(8);
      await share(11);
      const mine = await service.createThread(id, shared(1), recipient);
      expect(await events(otherRecipient)).toEqual(['thread.created']);
      expect((await notifications.unreadCount(otherRecipient)).count).toBe(1);
      await service.setThreadVisibility(id, mine.thread.id, visibility('private'), recipient);
      expect(await ids(otherRecipient)).toEqual([]);
      expect(await events(otherRecipient)).toEqual([]);
      expect((await notifications.unreadCount(otherRecipient)).count).toBe(0);
      await expect(
        service.reply(id, mine.thread.id, { requestId: randomUUID(), body: 'x' }, otherRecipient),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('shows other people no old-version text: no quote context, and no quote missing from their version', async () => {
      await share(8);
      const gone = await service.createThread(id, shared(1, at('Costs'), 'Cut this?'), recipient);
      const kept = await service.createThread(
        id,
        shared(1, at('Revenue grew'), 'Source?'),
        recipient,
      );
      await service.createSuggestion(
        id,
        suggestion(1, 'Costs', 'Expenses', { threadId: gone.thread.id }),
        recipient,
      );
      await revision(2, [{ id: 't1', kind: 'TEXT', text: 'Summary. Revenue grew 12% in Q3.' }]);
      await share(11);
      const view = await service.list(id, otherRecipient);
      const byId = new Map(view.threads.map(row => [row.id, row] as const));
      expect(byId.get(gone.thread.id)).toMatchObject({
        anchor: { quote: '', prefix: '', suffix: '' },
        location: { status: 'detached' },
      });
      expect(byId.get(gone.thread.id).suggestions[0]).toMatchObject({
        anchor: { quote: '', prefix: '', suffix: '' },
        replacement: 'Expenses',
      });
      expect(byId.get(kept.thread.id).anchor).toMatchObject({
        quote: 'Revenue grew',
        prefix: '',
        suffix: '',
      });
      expect(JSON.stringify(view)).not.toMatch(/Costs/);
      // The author and the owner keep the stored anchor.
      for (const actor of [recipient, owner])
        expect(
          (await service.list(id, actor)).threads.find(row => row.id === gone.thread.id).anchor,
        ).toMatchObject({ quote: 'Costs' });
    });

    it('skips suggestion notifications for recipients pinned before the suggestion', async () => {
      await share(8);
      await share(11);
      const open = await service.createThread(id, shared(1), owner);
      for (const actor of [recipient, otherRecipient])
        await service.reply(id, open.thread.id, { requestId: randomUUID(), body: 'Seen' }, actor);
      const v2 = 'Summary. Revenue grew 12% in Q3.';
      await revision(2, [{ id: 't1', kind: 'TEXT', text: v2 }]);
      await share(11);
      await service.createSuggestion(
        id,
        {
          requestId: randomUUID(),
          version: 2,
          threadId: open.thread.id,
          anchor: at('Summary', v2),
          replacement: 'Overview',
        },
        owner,
      );
      expect(await events(otherRecipient)).toContain('suggestion.created');
      expect(await events(recipient)).not.toContain('suggestion.created');
    });
  });
});
