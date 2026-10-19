jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DataSource } from 'typeorm';
import { StudioRemixService } from './studio-remix.service';
import { StudioReceivedRemixController } from './studio-received-remix.controller';
import { StudioRemixController } from './studio-remix.controller';
import { StudioRemixRequest } from './entities/studio-remix.entity';
import { studioDigest } from './studio-legacy';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { serializeMetadataWork } from '../common/metadata-work';
import * as actorFence from '../database/source-write-lock';
import * as dashboardFence from '../dashboard/dashboard-write-lock';
import * as sourceFence from '../metric/metric-write-lock';

const reference = 'd-10-1-20-3-' + 'a'.repeat(64);
const body = () => ({
  requestId: 'f20cf5ba-3150-4a65-beb0-259ee5ddbe72',
  expectedVersion: 3,
  expectedLifecycleRevision: 'c'.repeat(64),
  expectedSourceRevision: 'd'.repeat(64),
  targetSourceId: 9,
  mapping: { amount: 'total' },
  excludedBlockIds: [],
});
const entities = [User, Database, Dashboard, UserMapping, DashboardWidget, StudioRemixRequest];
describe('UC053 received independent-copy read-only recovery and JWT epoch', () => {
  let db: DataSource, service: StudioRemixService;
  const origin = jest.fn(async () => {
    throw new Error('Origin must not be used for recovery');
  });
  const connection = { withDuckDBSnapshot: jest.fn(async (_id, run) => run()) };
  const dashboards = { preview: jest.fn() };
  const creation = {
    compile: jest.fn(),
    profile: jest.fn(),
    prepareRemix: jest.fn(),
    persistRemix: jest.fn(),
    validateBusinessDates: jest.fn(async () => undefined),
    ensureCurrentSource: jest.fn(async () => undefined),
  };
  const studio = { serializeWrite: (run: any) => serializeMetadataWork(db, run) };
  const saved = {
    dashboardId: 30,
    document: {
      dashboardId: 30,
      sourceId: 9,
      revision: 'b'.repeat(64),
      private: 'must-not-return',
    },
  };
  const snapshot = async () =>
    JSON.stringify(await Promise.all(entities.map(e => db.manager.find(e))));
  const result = async (input = body(), ref = reference, actor = 2, epoch = 7) =>
    (service as any).receivedResult(ref, input, actor, epoch);
  const seedReceipt = async (ref = reference, input = body(), value: any = saved) =>
    db.manager.insert(StudioRemixRequest, {
      actorId: 2,
      requestId: input.requestId,
      payloadHash: studioDigest({ token: ref, ...input }),
      result: typeof value === 'string' ? value : JSON.stringify(value),
    });
  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
    service = new StudioRemixService(
      db,
      studio as any,
      { requireRemix: origin } as any,
      creation as any,
      dashboards as any,
      connection as any,
      new SourceAccessService(db),
    );
  });
  beforeEach(async () => {
    for (const entity of [...entities].reverse())
      await db.getRepository(entity).createQueryBuilder().delete().execute();
    await db.manager.insert(
      User,
      [1, 2, 3].map(id => ({
        id,
        userId: `copy-recovery-${id}`,
        email: `${id}@example.invalid`,
        password: 'synthetic',
        active: true,
        authVersion: id === 2 ? 7 : 0,
      })),
    );
    await db.manager.insert(Database, [
      {
        id: 9,
        ownerId: 2,
        name: 'Private target',
        engine: 'duckdb',
        type: 'duckdb',
        connectionConfig: '{}',
      },
      {
        id: 99,
        ownerId: 3,
        name: 'Other target',
        engine: 'duckdb',
        type: 'duckdb',
        connectionConfig: '{}',
      },
    ]);
    await db.manager.insert(Dashboard, {
      id: 30,
      title: 'Private copy',
      analysisDefinition: JSON.stringify({ databaseId: 9 }),
    });
    await db.manager.insert(UserMapping, { userInfoId: 2, dashboardId: 30 });
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  it('received controller forwards result and save JWT epoch; publication save keeps resolver slot', async () => {
    const remix = { receivedResult: jest.fn(), remix: jest.fn(), preview: jest.fn() },
      resolve = jest.fn();
    const c = new StudioReceivedRemixController({ resolve } as any, remix as any),
      request = { user: { accessKeyData: { id: 2, authVersion: 7 } } };
    await (c as any).result(reference, body(), request);
    expect(remix.receivedResult).toHaveBeenCalledWith(reference, body(), 2, 7);
    c.save(reference, body(), request);
    expect(remix.remix).toHaveBeenLastCalledWith(reference, body(), 2, resolve, 7);
    new StudioRemixController(remix as any).remix('e'.repeat(64), body(), request);
    expect(remix.remix).toHaveBeenLastCalledWith('e'.repeat(64), body(), 2, undefined, 7);
    c.preview(reference, body(), request);
    expect(remix.preview).toHaveBeenLastCalledWith(reference, body(), 2, resolve, 7);
    new StudioRemixController(remix as any).preview('e'.repeat(64), body(), request);
    expect(remix.preview).toHaveBeenLastCalledWith('e'.repeat(64), body(), 2, undefined, 7);
  });
  it('missing receipt returns only found:false after actual current target ownership; writes zero', async () => {
    const before = await snapshot();
    await expect(result()).resolves.toEqual({ found: false });
    expect(await snapshot()).toBe(before);
    expect(origin).not.toHaveBeenCalled();
    expect(connection.withDuckDBSnapshot).not.toHaveBeenCalled();
    expect(creation.profile).not.toHaveBeenCalled();
    expect(creation.persistRemix).not.toHaveBeenCalled();
  });
  it.each([reference, 'g-10-1-20-3-4-5-' + 'a'.repeat(64)])(
    'finds exact saved copy without any origin rows or live sharing (%s)',
    async ref => {
      await seedReceipt(ref);
      const before = await snapshot();
      await expect(result(body(), ref)).resolves.toEqual({
        found: true,
        dashboardId: 30,
        sourceId: 9,
        revision: 'b'.repeat(64),
      });
      expect(await snapshot()).toBe(before);
      expect(origin).not.toHaveBeenCalled();
      expect(connection.withDuckDBSnapshot).not.toHaveBeenCalled();
      expect(creation.persistRemix).not.toHaveBeenCalled();
    },
  );
  it('digest rejects changed valid reference or frozen body, without exposing hash/document', async () => {
    await seedReceipt();
    const before = await snapshot();
    await expect(result({ ...body(), mapping: { amount: 'other' } })).rejects.toMatchObject({
      status: 409,
    });
    await expect(result(body(), reference.replace('-3-', '-4-'))).rejects.toMatchObject({
      status: 409,
    });
    expect(await snapshot()).toBe(before);
  });
  it('normalizes omitted excludedBlockIds exactly like save', async () => {
    await seedReceipt();
    const input = body();
    delete input.excludedBlockIds;
    await expect(result(input)).resolves.toMatchObject({ found: true });
  });
  it.each([
    'public-token',
    'd-0-1-20-3-' + 'a'.repeat(64),
    'd-10-9007199254740992-20-3-' + 'a'.repeat(64),
  ])('rejects invalid private reference %s', async ref => {
    const before = await snapshot();
    await expect(result(body(), ref)).rejects.toMatchObject({ status: 400 });
    expect(await snapshot()).toBe(before);
  });
  it('rejects extra/missing save fields and invalid target before receipt access', async () => {
    await expect(result({ ...body(), extra: true } as any)).rejects.toMatchObject({ status: 400 });
    const input = body();
    delete input.expectedLifecycleRevision;
    await expect(result(input)).rejects.toMatchObject({ status: 400 });
    await expect(result({ ...body(), targetSourceId: 0 })).rejects.toMatchObject({ status: 400 });
  });
  it.each([false, true])('rejects stale JWT epoch even when receipt exists=%s', async exists => {
    if (exists) await seedReceipt();
    const before = await snapshot();
    await expect(result(body(), reference, 2, 6)).rejects.toMatchObject({ status: 403 });
    expect(await snapshot()).toBe(before);
  });
  it.each(['source-owner', 'source-active', 'copy-owner', 'copy-active'])(
    'blocks current %s loss on found result',
    async change => {
      await seedReceipt();
      if (change === 'source-owner') await db.manager.update(Database, 9, { ownerId: 1 });
      if (change === 'source-active')
        await db.manager.update(Database, 9, { catalogActive: false });
      if (change === 'copy-owner')
        await db.manager.update(UserMapping, { dashboardId: 30 }, { userInfoId: 1 });
      if (change === 'copy-active') await db.manager.update(Dashboard, 30, { assetActive: false });
      const before = await snapshot();
      await expect(result()).rejects.toMatchObject({ status: 403 });
      expect(await snapshot()).toBe(before);
    },
  );
  it('does not reveal another actor receipt and cannot probe missing with someone else source', async () => {
    await seedReceipt();
    await expect(result({ ...body(), targetSourceId: 99 }, reference, 3, 0)).resolves.toEqual({
      found: false,
    });
    await expect(result(body(), reference, 3, 0)).rejects.toMatchObject({ status: 403 });
  });
  it.each([
    'not-json',
    { dashboardId: 30, document: { dashboardId: 30, sourceId: 99, revision: 'b'.repeat(64) } },
    { dashboardId: 30, document: { dashboardId: 31, sourceId: 9, revision: 'b'.repeat(64) } },
  ])('rejects malformed or target-mismatched durable result', async value => {
    await seedReceipt(reference, body(), value);
    await expect(result()).rejects.toMatchObject({ status: 409 });
  });
  it('save rejects old epoch before first replay/origin/calculation', async () => {
    const before = await snapshot();
    await expect((service.remix as any)(reference, body(), 2, origin, 6)).rejects.toMatchObject({
      status: 403,
    });
    expect(origin).not.toHaveBeenCalled();
    expect(connection.withDuckDBSnapshot).not.toHaveBeenCalled();
    expect(await snapshot()).toBe(before);
  });
  it('save releases its first User transaction before origin preparation/long work', async () => {
    const stop = jest.fn(async () => {
      expect(db.createQueryRunner().isTransactionActive).toBe(false);
      throw new Error('external preparation boundary');
    });
    await expect((service.remix as any)(reference, body(), 2, stop, 7)).rejects.toThrow(
      'external preparation boundary',
    );
    expect(stop).toHaveBeenCalled();
  });
  it('save rechecks epoch in final transaction before persist, also without business basis', async () => {
    const row = {
        version: 3,
        lifecycleRevision: 'c'.repeat(64),
        remixTemplate: JSON.stringify({ blocks: [], requiredFields: [] }),
      },
      resolver = jest.fn(async () => row);
    creation.profile.mockResolvedValue({
      dataVersion: 'd'.repeat(64),
      schemaVersion: 'e'.repeat(64),
      columns: [],
    });
    creation.prepareRemix.mockImplementation(async () => {
      await db.manager.update(User, 2, { authVersion: 8 });
      return {};
    });
    jest.spyOn(service as any, 'map').mockResolvedValue({
      blocks: [],
      kept: ['block'],
      unmappedConditions: [],
      unmappedFilters: [],
      unmappedBlocks: [],
      filters: [],
    });
    await expect((service.remix as any)(reference, body(), 2, resolver, 7)).rejects.toMatchObject({
      status: 403,
    });
    expect(creation.persistRemix).not.toHaveBeenCalled();
    expect(await db.manager.count(StudioRemixRequest)).toBe(0);
    expect(await db.manager.count(Dashboard)).toBe(1);
  });
  const setupPreview = () => {
    const input: any = { ...body() };
    delete input.requestId;
    delete input.expectedSourceRevision;
    const row = {
        version: 3,
        lifecycleRevision: 'c'.repeat(64),
        remixTemplate: JSON.stringify({ title: 'Clone', blocks: [], requiredFields: [] }),
      },
      resolver = jest.fn(async () => row);
    creation.profile.mockResolvedValue({
      sourceId: 9,
      dataVersion: 'd'.repeat(64),
      schemaVersion: 'e'.repeat(64),
      columns: [],
      rowCount: '1',
    });
    creation.compile.mockReturnValue({ databaseId: 9, widgets: [] });
    jest.spyOn(service as any, 'map').mockResolvedValue({
      blocks: [{}],
      kept: ['block'],
      unmappedConditions: [],
      unmappedFilters: [],
      unmappedBlocks: [],
      filters: [],
      mapping: {},
      fields: [],
    });
    return { input, resolver };
  };
  const aggregate = {
    data: {
      widgets: [
        {
          title: 'Value',
          type: 'BOARD_NUMERIC',
          valueField: 'value',
          fields: [],
          datas: [{ value: 123456789 }],
        },
      ],
    },
  };
  it('preview current epoch permits aggregate and holds no User transaction during calculation', async () => {
    const { input, resolver } = setupPreview();
    dashboards.preview.mockImplementation(async () => {
      expect(db.createQueryRunner().isTransactionActive).toBe(false);
      return aggregate;
    });
    const value = await service.preview(reference, input, 2, resolver, 7);
    expect(value.preview.widgets[0].datas[0].value).toBe(123456789);
  });
  it('preview stale epoch fails before origin or aggregate calculation', async () => {
    const { input, resolver } = setupPreview();
    await expect(service.preview(reference, input, 2, resolver, 6)).rejects.toMatchObject({
      status: 403,
    });
    expect(resolver).not.toHaveBeenCalled();
    expect(dashboards.preview).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'preview revocation during delayed computation hides success/error details (error=%s)',
    async failure => {
      const { input, resolver } = setupPreview();
      let entered: () => void, release: () => void;
      const held = new Promise<void>(r => (entered = r)),
        gate = new Promise<void>(r => (release = r));
      dashboards.preview.mockImplementation(async () => {
        expect(db.createQueryRunner().isTransactionActive).toBe(false);
        entered();
        await gate;
        if (failure) throw new Error('private computed 123456789');
        return aggregate;
      });
      const computing = service.preview(reference, input, 2, resolver, 7).then(
        value => ({ value }),
        error => ({ error }),
      );
      await held;
      await db.manager.update(User, 2, { authVersion: 8 });
      release();
      const outcome: any = await computing;
      expect(outcome.value).toBeUndefined();
      expect(outcome.error).toMatchObject({ status: 403 });
      expect(String(outcome.error)).not.toContain('123456789');
    },
  );
  it('preview rechecks epoch after error freshness inspection before any error details leave', async () => {
    const { input, resolver } = setupPreview();
    dashboards.preview.mockRejectedValue(new Error('private calculation detail'));
    jest.spyOn(service as any, 'guardComputation').mockImplementation(async () => {
      await db.manager.update(User, 2, { authVersion: 8 });
      throw new Error('private refreshed detail');
    });
    await expect(service.preview(reference, input, 2, resolver, 7)).rejects.toMatchObject({
      status: 403,
    });
  });
  it.each([false, true])(
    'result fences only User then clone Dashboard then target Source (found=%s)',
    async found => {
      if (found) await seedReceipt();
      const order: string[] = [],
        user = actorFence.lockSourceActor,
        dashboard = dashboardFence.lockDashboardWrite,
        source = sourceFence.lockMetricSources;
      jest.spyOn(actorFence, 'lockSourceActor').mockImplementation(async (...args) => {
        order.push(`user:${args[1]}`);
        return user(...args);
      });
      jest.spyOn(dashboardFence, 'lockDashboardWrite').mockImplementation(async (...args) => {
        order.push(`dashboard:${args[1]}`);
        return dashboard(...args);
      });
      jest.spyOn(sourceFence, 'lockMetricSources').mockImplementation(async (...args) => {
        order.push(`sources:${args[1].join(',')}`);
        return source(...args);
      });
      const before = await snapshot();
      await result();
      expect(order).toEqual(
        found ? ['user:2', 'dashboard:30', 'sources:9'] : ['user:2', 'sources:9'],
      );
      expect(await snapshot()).toBe(before);
    },
  );
});
