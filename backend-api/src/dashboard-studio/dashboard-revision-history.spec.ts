import { DataSource } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { User } from '../user/entities/user.entity';
import {
  AI_REVISIONS_KEPT,
  deleteDashboardRevisions,
  recordDashboardRevision,
} from './dashboard-revision-history';
import { DashboardRevision } from './entities/dashboard-revision.entity';

describe('dashboard revision history', () => {
  let db: DataSource;
  const dashboard = (id: number) =>
    ({
      id,
      title: `d${id}`,
      layout: '[]',
      analysisDefinition: '{"a":1}',
      structuredDefinition: null,
      pivotDefinitions: null,
    } as unknown as Dashboard);
  const ai = { kind: 'external-ai' as const, grantId: 'grant-1', clientName: 'Claude Code' };
  const save = (
    id: number,
    operation: 'create' | 'save' | 'restore',
    author?: typeof ai,
    revision = 'r'.repeat(64),
  ) =>
    recordDashboardRevision(db.manager, {
      dashboard: dashboard(id),
      actorId: 7,
      studioDocument: '{"document":{}}',
      revision,
      operation,
      author,
      requestId: 'req-' + Math.random().toString(16).slice(2),
    });
  const rows = (id: number) =>
    db.manager.find(DashboardRevision, { where: { dashboardId: id }, order: { seq: 'ASC' } });

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [DashboardRevision, EnterpriseMembership, EnterpriseAuditEvent, User],
    }).initialize();
  });
  beforeEach(async () => {
    await db.manager.clear(DashboardRevision);
    await db.manager.clear(EnterpriseAuditEvent);
    await db.manager.clear(EnterpriseMembership);
    delete process.env.DASHBOARD_REVISION_HISTORY;
  });
  afterAll(() => db.destroy());

  it('writes the dashboard as it is, with the person who saved it and a seq that orders the rows', async () => {
    await save(1, 'create');
    await save(1, 'save');
    const [first, second] = await rows(1);
    expect(first).toMatchObject({
      dashboardId: 1,
      title: 'd1',
      layout: '[]',
      analysisDefinition: '{"a":1}',
      structuredDefinition: null,
      actorId: 7,
      organizationId: null,
      operation: 'create',
      authorKind: 'human',
      aiGrantId: null,
      aiClientName: null,
    });
    expect(first.revisionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.seq).toBeGreaterThan(first.seq);
    expect(second.operation).toBe('save');
  });

  it("fills in the actor's organization when there is a membership", async () => {
    await db.manager.insert(User, {
      id: 7,
      userId: 'member7',
      email: 'member7@example.invalid',
      password: 'x',
      active: true,
      authVersion: 0,
    } as never);
    await db.manager.insert(EnterpriseMembership, {
      userId: 7,
      organizationId: 42,
      role: 'editor',
      team: '',
    } as never);
    try {
      await save(1, 'save');
      expect((await rows(1))[0].organizationId).toBe(42);
    } finally {
      await db.manager.delete(EnterpriseMembership, { userId: 7 });
      await db.manager.delete(User, { id: 7 });
    }
  });

  it('records the connection behind an external AI save', async () => {
    await save(1, 'save', ai);
    expect((await rows(1))[0]).toMatchObject({
      authorKind: 'external-ai',
      aiGrantId: 'grant-1',
      aiClientName: 'Claude Code',
    });
  });

  it("audits an external AI's create, update and restore in its organization, and nothing else", async () => {
    await db.manager.insert(User, {
      id: 7,
      userId: 'u7',
      email: 'u7@example.invalid',
      password: 'x',
      active: true,
      authVersion: 0,
    } as never);
    await db.manager.insert(EnterpriseMembership, {
      userId: 7,
      organizationId: 3,
      role: 'contributor',
      team: '',
    });
    await save(1, 'create', ai);
    await save(1, 'save', ai);
    await save(1, 'restore', ai);
    await recordDashboardRevision(db.manager, {
      dashboard: dashboard(1),
      actorId: 7,
      studioDocument: '{"document":{}}',
      revision: 'b'.repeat(64),
      operation: 'baseline',
      author: ai,
      always: true,
    });
    // A person's own save is not an AI event.
    await save(1, 'save');
    const events = await db.manager.find(EnterpriseAuditEvent, { order: { id: 'ASC' } });
    expect(events.map(event => [event.action, event.organizationId, event.resourceId])).toEqual([
      ['dashboard.mcp-create', 3, 1],
      ['dashboard.mcp-update', 3, 1],
      ['dashboard.mcp-restore', 3, 1],
    ]);
  });

  it("caps an external AI's own saves and keeps every person's save and every creation", async () => {
    await save(1, 'create', ai);
    await save(1, 'save'); // a person's save
    for (let i = 0; i < AI_REVISIONS_KEPT + 20; i++) await save(1, 'save', ai);
    await save(1, 'save'); // another person's save, after the AI's burst
    const kept = await rows(1);
    expect(kept.filter(r => r.operation === 'create')).toHaveLength(1);
    expect(kept.filter(r => r.authorKind === 'human')).toHaveLength(2);
    expect(
      kept.filter(r => r.authorKind === 'external-ai' && r.operation !== 'create'),
    ).toHaveLength(AI_REVISIONS_KEPT);
    // The oldest AI saves went, the newest stayed: the AI rows left are the last ones written.
    const aiRows = kept.filter(r => r.authorKind === 'external-ai' && r.operation !== 'create');
    const human = kept.filter(r => r.authorKind === 'human');
    expect(aiRows[0].seq).toBeGreaterThan(human[0].seq);
  });

  it("caps an external AI's restores together with its saves", async () => {
    for (let i = 0; i < AI_REVISIONS_KEPT + 10; i++) await save(1, i % 2 ? 'restore' : 'save', ai);
    const kept = await rows(1);
    expect(kept).toHaveLength(AI_REVISIONS_KEPT);
    expect(new Set(kept.map(r => r.operation))).toEqual(new Set(['save', 'restore']));
  });

  it("does not let one dashboard's saves prune another's history", async () => {
    for (let i = 0; i < AI_REVISIONS_KEPT + 5; i++) await save(1, 'save', ai);
    await save(2, 'save', ai);
    expect(await rows(2)).toHaveLength(1);
    expect(await rows(1)).toHaveLength(AI_REVISIONS_KEPT);
  });

  it("stops writing a person's saves when switched off, but never an external AI's", async () => {
    process.env.DASHBOARD_REVISION_HISTORY = 'off';
    await save(1, 'save');
    expect(await rows(1)).toHaveLength(0);
    await save(1, 'save', ai);
    expect(await rows(1)).toHaveLength(1);
  });

  it('removes a dashboard history with it and leaves the others', async () => {
    await save(1, 'create');
    await save(2, 'create');
    await deleteDashboardRevisions(db.manager, 1);
    expect(await rows(1)).toHaveLength(0);
    expect(await rows(2)).toHaveLength(1);
  });
});
