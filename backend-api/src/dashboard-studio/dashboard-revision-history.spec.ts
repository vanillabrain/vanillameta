import { DataSource } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
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
      entities: [DashboardRevision, EnterpriseMembership, User],
    }).initialize();
  });
  beforeEach(async () => {
    await db.manager.clear(DashboardRevision);
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

  it('records the connection behind an external AI save', async () => {
    await save(1, 'save', ai);
    expect((await rows(1))[0]).toMatchObject({
      authorKind: 'external-ai',
      aiGrantId: 'grant-1',
      aiClientName: 'Claude Code',
    });
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

  it("does not let one dashboard's saves prune another's history", async () => {
    for (let i = 0; i < AI_REVISIONS_KEPT + 5; i++) await save(1, 'save', ai);
    await save(2, 'save', ai);
    expect(await rows(2)).toHaveLength(1);
    expect(await rows(1)).toHaveLength(AI_REVISIONS_KEPT);
  });

  it('writes nothing when the history is switched off', async () => {
    process.env.DASHBOARD_REVISION_HISTORY = 'off';
    await save(1, 'save');
    expect(await rows(1)).toHaveLength(0);
  });

  it('removes a dashboard history with it and leaves the others', async () => {
    await save(1, 'create');
    await save(2, 'create');
    await deleteDashboardRevisions(db.manager, 1);
    expect(await rows(1)).toHaveLength(0);
    expect(await rows(2)).toHaveLength(1);
  });
});
