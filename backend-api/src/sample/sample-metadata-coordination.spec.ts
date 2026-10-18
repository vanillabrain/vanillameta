import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SampleService } from './sample.service';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Component } from '../component/entities/component.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { serializeMetadataWork } from '../common/metadata-work';

const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
};
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

describe('UC051 sample provisioning metadata coordination (real SQLite)', () => {
  let db: DataSource;
  let service: SampleService;
  let uploadDir: string;
  const previousUploadDir = process.env.FILE_UPLOAD_DIR;
  const previousSecret = process.env.CONFIG_SECRET_KEY;

  beforeEach(async () => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-sample-coordination-'));
    process.env.FILE_UPLOAD_DIR = uploadDir;
    process.env.CONFIG_SECRET_KEY = 'sample-coordination-secret';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Database,
        Dataset,
        Widget,
        Component,
        Dashboard,
        DashboardShare,
        DashboardWidget,
        UserMapping,
      ],
    }).initialize();
    await db.getRepository(Component).save([
      { type: 'BOARD_NUMERIC', title: 'numeric', option: '{}' },
      { type: 'CHART_BAR', title: 'bar', option: '{}' },
    ]);
    service = new SampleService(
      db.getRepository(Database),
      db.getRepository(Dataset),
      db.getRepository(Widget),
      db.getRepository(Component),
      db.getRepository(Dashboard),
      db.getRepository(DashboardShare),
      db.getRepository(DashboardWidget),
      db.getRepository(UserMapping),
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await db.destroy();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    if (previousUploadDir === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousUploadDir;
    if (previousSecret === undefined) delete process.env.CONFIG_SECRET_KEY;
    else process.env.CONFIG_SECRET_KEY = previousSecret;
  });

  it('queues sample metadata behind a held rollback instead of joining it', async () => {
    const databases = db.getRepository(Database);
    await databases.save({
      id: 1,
      ownerId: 999,
      name: 'placeholder',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    const entered = gate();
    const release = gate();
    const held = serializeMetadataWork(db, () =>
      db.transaction(async manager => {
        await manager.update(Database, 1, { ownerId: 998 });
        entered.resolve();
        await release.promise;
        throw new Error('expected rollback');
      }),
    ).catch(error => error);
    await entered.promise;

    let settled = false;
    const provision = service.provisionForUser(7).then(() => {
      settled = true;
    });
    let observed: { createdBeforeRelease: number; settledBeforeRelease: boolean };
    try {
      await delay(150);
      observed = {
        createdBeforeRelease: await databases.count({ where: { ownerId: 7 } }),
        settledBeforeRelease: settled,
      };
    } finally {
      release.resolve();
      await held;
      await provision;
    }

    expect(observed).toEqual({ createdBeforeRelease: 0, settledBeforeRelease: false });
    expect(await databases.count({ where: { ownerId: 7 } })).toBe(1);
    expect((await databases.findOneByOrFail({ id: 1 })).ownerId).toBe(999);
  });

  it('keeps the shared metadata queue free while the external sample file is written', async () => {
    const fileEntered = gate();
    const fileRelease = gate();
    const original = (SampleService.prototype as any).writeSampleSqlite;
    jest
      .spyOn(SampleService.prototype as any, 'writeSampleSqlite')
      .mockImplementation(async function (this: any) {
        fileEntered.resolve();
        await fileRelease.promise;
        return original.call(this);
      });

    const provision = service.provisionForUser(7);
    await fileEntered.promise;
    let queueFree = false;
    const sentinel = serializeMetadataWork(db, async () => {
      queueFree = true;
    });
    try {
      await Promise.race([sentinel, delay(150)]);
      expect(queueFree).toBe(true);
    } finally {
      fileRelease.resolve();
      await Promise.all([provision, sentinel]);
    }

    expect(await db.getRepository(Database).count({ where: { ownerId: 7 } })).toBe(1);
    expect(await db.getRepository(Dataset).count()).toBe(1);
    expect(await db.getRepository(Widget).count()).toBe(2);
    expect(await db.getRepository(Dashboard).count()).toBe(1);
    expect(await db.getRepository(DashboardWidget).count()).toBe(2);
    expect(await db.getRepository(UserMapping).count()).toBe(1);
    expect(fs.readdirSync(uploadDir).some(name => name.endsWith('.db'))).toBe(true);
  });
});
