import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PersonalView } from './entities/personal-view.entity';
import { PersonalViewService } from './personal-view.service';
import { resolveViewDates, validatePersonalViewState } from './personal-view-state';
import { AddPersonalViews1791854000000 } from '../migrations/1791854000000-add-personal-views';
import { dashboardRevision } from './dashboard-revision';
import { Dashboard } from './entities/dashboard.entity';
import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';

const dashboard = {
  id: 26,
  title: 'Saved dashboard',
  assetActive: true,
  assetVersion: 0,
  delYn: 'N',
  layout: null,
  analysisDefinition: null,
  structuredDefinition: null,
} as unknown as Dashboard;
const revision = dashboardRevision(dashboard);
const state = () => ({
  version: 1,
  filters: [{ column: 'channel', values: ['online', null] }],
  dateRange: { column: 'day', start: '2026-01-11', end: '2026-01-12' },
  relativePeriod: null,
  numberNotation: 'compact',
});
describe('personal saved views', () => {
  let db: DataSource;
  let service: PersonalViewService;
  let access: any;

  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [PersonalView, Dashboard],
      synchronize: true,
    }).initialize();
    access = {
      dashboard: jest.fn(async (_id, actor) => {
        if (actor !== 5) throw new ForbiddenException();
      }),
      id: value => {
        if (!Number.isSafeInteger(value) || value <= 0) throw new Error('invalid id');
        return value;
      },
    };
    await db.getRepository(Dashboard).save([dashboard, { ...dashboard, id: 27 }]);
    service = new PersonalViewService(db.getRepository(PersonalView), access);
  });
  afterEach(async () => {
    await db.destroy();
  });
  it('persists exact typed conditions independently and restores through a new service instance', async () => {
    const created = await service.create(26, 5, {
      name: '  온라인 매출  ',
      state: state(),
      revision,
    });
    const reloaded = new PersonalViewService(db.getRepository(PersonalView), access);
    const loaded = await reloaded.load(26, created.data.id, 5);
    expect(loaded.data.state).toEqual(state());
    expect(loaded.data.resolvedDateRange).toEqual(state().dateRange);
    expect(loaded.data.name).toBe('온라인 매출');
    expect(Object.keys(loaded.data).sort()).toEqual([
      'createdAt',
      'id',
      'name',
      'resolvedDateRange',
      'revision',
      'state',
    ]);
    expect(access.dashboard).toHaveBeenCalledWith(26, 5, 'read', expect.anything());
    await reloaded.remove(26, created.data.id, 5);
    expect((await reloaded.list(26, 5)).data).toEqual([]);
    expect(await db.getRepository(Dashboard).count()).toBe(2);
  });

  it('persists timezone across a fresh service and resolves relative calendar dates', async () => {
    const zoned = {
      ...state(),
      dateRange: null,
      relativePeriod: { column: 'day', days: 7, timeZone: 'Asia/Seoul' },
    };
    const created = await service.create(26, 5, { name: 'KST', state: zoned, revision });
    const loaded = await new PersonalViewService(db.getRepository(PersonalView), access).load(
      26,
      created.data.id,
      5,
    );
    expect(loaded.data.state).toEqual(zoned);
    expect(loaded.data.resolvedDateRange.timeZone).toBe('Asia/Seoul');
    expect(loaded.data.resolvedDateRange).toEqual(
      resolveViewDates(validatePersonalViewState(zoned)),
    );
  });
  it('persists and restores a half-open timestamp selection without converting it to inclusive days', async () => {
    const dateRange = {
      column: 'event_time',
      start: '2024-02-29T12:30:00Z',
      end: '2024-02-29T13:00:00Z',
      precision: 'timestamp' as const,
    };
    const created = await service.create(26, 5, {
      name: 'Hour selection',
      revision,
      state: { ...state(), dateRange, comparePrevious: true },
    });
    const loaded = await new PersonalViewService(db.getRepository(PersonalView), access).load(
      26,
      created.data.id,
      5,
    );
    expect(loaded.data.state.dateRange).toEqual(dateRange);
    expect(loaded.data.resolvedDateRange).toEqual(dateRange);
    expect(loaded.data.state.comparePrevious).toBe(true);
  });
  it('re-evaluates a relative period each open across UTC month/leap boundaries while absolute dates stay fixed', () => {
    const relative = validatePersonalViewState({
      ...state(),
      dateRange: null,
      relativePeriod: { column: 'day', days: 7 },
    });
    expect(resolveViewDates(relative, new Date('2024-03-01T00:00:01Z'))).toEqual({
      column: 'day',
      start: '2024-02-24',
      end: '2024-03-01',
    });
    expect(resolveViewDates(relative, new Date('2024-03-02T00:00:01Z'))).toEqual({
      column: 'day',
      start: '2024-02-25',
      end: '2024-03-02',
    });
    expect(resolveViewDates(validatePersonalViewState(state()), new Date('2027-01-01Z'))).toEqual(
      state().dateRange,
    );
    expect(relative.dateRange).toBeNull();
  });
  it.each(['list', 'load', 'remove', 'create'])(
    'denies other accounts and rechecks revoked ownership for %s',
    async method => {
      const row = await service.create(26, 5, { name: 'Mine', state: state(), revision });
      const action = actor =>
        method === 'list'
          ? service.list(26, actor)
          : method === 'create'
          ? service.create(26, actor, { name: 'Mine', state: state(), revision })
          : service[method](26, row.data.id, actor);
      await expect(action(6)).rejects.toBeInstanceOf(ForbiddenException);
      access.dashboard.mockRejectedValue(new ForbiddenException());
      await expect(action(5)).rejects.toBeInstanceOf(ForbiddenException);
      expect(await db.getRepository(PersonalView).count()).toBe(1);
    },
  );
  it('never returns or deletes a view belonging to another dashboard or user', async () => {
    const row = await service.create(26, 5, { name: 'Mine', state: state(), revision });
    await expect(service.load(27, row.data.id, 5)).rejects.toThrow('저장 보기를 찾을 수 없습니다.');
    await expect(service.remove(27, row.data.id, 5)).rejects.toThrow(
      '저장 보기를 찾을 수 없습니다.',
    );
    expect(await db.getRepository(PersonalView).count()).toBe(1);
  });
  it('blocks changed definition rather than silently applying old conditions to new metrics', async () => {
    const row = await service.create(26, 5, { name: 'Mine', state: state(), revision });
    await db.getRepository(Dashboard).update(26, { title: 'New metric definition' });
    await expect(service.load(26, row.data.id, 5)).rejects.toThrow(
      '대시보드 정의가 변경되었습니다.',
    );
    await expect(
      service.create(26, 5, { name: 'stale', state: state(), revision }),
    ).rejects.toThrow('대시보드 정의가 변경되었습니다.');
    expect((await service.list(26, 5)).data).toHaveLength(1);
    await service.remove(26, row.data.id, 5);
  });
  it('limits saved views to 20 per dashboard while allowing independent dashboards', async () => {
    for (let i = 0; i < 20; i++)
      await service.create(26, 5, { name: `${i}`, state: state(), revision });
    await expect(
      service.create(26, 5, { name: 'overflow', state: state(), revision }),
    ).rejects.toThrow('최대 20개');
    expect(
      (
        await service.create(27, 5, {
          name: 'another',
          state: state(),
          revision: dashboardRevision({ ...dashboard, id: 27 }),
        })
      ).status,
    ).toBe('SUCCESS');
  });
  it('serializes 21 simultaneous creates so the cap stays 20 and failed writes do not block later work', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 21 }, (_, i) =>
        service.create(26, 5, { name: `${i}`, state: state(), revision }),
      ),
    );
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(20);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(await db.getRepository(PersonalView).count()).toBe(20);
    const first = (await service.list(26, 5)).data[0];
    await service.remove(26, first.id, 5);
    await expect(
      service.create(26, 5, { name: 'After failure', state: state(), revision }),
    ).resolves.toMatchObject({ status: 'SUCCESS' });
  });
  it.each(['change', 'delete'])(
    'checks definition inside the insertion transaction after a concurrent %s',
    async action => {
      const transaction = db.manager.transaction.bind(db.manager);
      jest.spyOn(db.manager, 'transaction').mockImplementationOnce(async (callback: any) => {
        if (action === 'change')
          await db.getRepository(Dashboard).update(26, { title: 'Concurrent edit' });
        else await db.getRepository(Dashboard).delete(26);
        return transaction(callback);
      });
      await expect(
        service.create(26, 5, { name: 'Raced', state: state(), revision }),
      ).rejects.toThrow('대시보드 정의가 변경되었습니다.');
      expect(await db.getRepository(PersonalView).count()).toBe(0);
    },
  );
  it.each([
    { version: 2 },
    { filters: Array(6).fill({ column: 'a', values: [1] }) },
    { filters: [{ column: 'x', values: ['x'.repeat(257)] }] },
    { filters: [{ column: 'x', values: [{ password: 'secret' }] }] },
    { filters: [{ column: 'x', values: [NaN] }] },
    {
      filters: [
        { column: 'x', values: [1] },
        { column: 'x', values: [2] },
      ],
    },
    { dateRange: { column: 'day', start: '2026-02-30', end: '2026-03-01' } },
    { dateRange: { column: 'day', start: '2026-03-02', end: '2026-03-01' } },
    { relativePeriod: { column: 'day', days: 7 } },
    { dateRange: null, relativePeriod: { column: 'day', days: 365 } },
    { credentials: 'secret' },
    { numberNotation: 'unknown' },
  ])('rejects unbounded, ambiguous or secret-bearing state %j', async patch => {
    await expect(
      service.create(26, 5, { name: 'invalid', state: { ...state(), ...patch }, revision }),
    ).rejects.toThrow();
    expect(await db.getRepository(PersonalView).count()).toBe(0);
  });
  it('shared tokens cannot create, list, load or delete personal views', async () => {
    for (const method of ['listViews', 'createView', 'loadView', 'removeView']) {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { shareKeyData: { dashboardId: 26 } } }),
        }),
        getClass: () => ({ name: 'DashboardController' }),
        getHandler: () => ({ name: method }),
      };
      await expect(new SourceOwnershipGuard(access).canActivate(context as any)).rejects.toThrow(
        'share access denied',
      );
    }
  });
});
it('personal-view migration is idempotent and leaves legacy metadata and saved state intact', async () => {
  const db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
  const runner = db.createQueryRunner();
  try {
    await runner.query('CREATE TABLE dashboard (id integer primary key, title text)');
    await runner.query("INSERT INTO dashboard VALUES (26, 'Existing')");
    const migration = new AddPersonalViews1791854000000();
    await migration.up(runner);
    await runner.query(
      'INSERT INTO personal_view (dashboardId,userId,name,revision,state) VALUES (?,?,?,?,?)',
      [26, 5, 'Saved', revision, JSON.stringify(state())],
    );
    await migration.up(runner);
    expect(await runner.query('SELECT * FROM dashboard')).toEqual([{ id: 26, title: 'Existing' }]);
    expect((await runner.query('SELECT state FROM personal_view'))[0].state).toBe(
      JSON.stringify(state()),
    );
  } finally {
    await runner.release();
    await db.destroy();
  }
});
