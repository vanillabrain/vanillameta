import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CommerceStudioService } from './commerce-studio.service';
import { CommerceSource } from './entities/commerce-source.entity';
import { Database } from '../database/entities/database.entity';
import { DuckDBService } from '../analysis/duckdb.service';
import { decryptConnectionConfig, encryptConnectionConfig } from '../utils/crypto.util';

describe('Commerce immutable Studio source bridge', () => {
  let db: DataSource,
    worker: DuckDBService,
    service: CommerceStudioService,
    root: string,
    filename: string;
  const previous = {
    FILE_UPLOAD_DIR: process.env.FILE_UPLOAD_DIR,
    CONFIG_SECRET_KEY: process.env.CONFIG_SECRET_KEY,
  };
  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'commerce-studio-'));
    process.env.FILE_UPLOAD_DIR = root;
    process.env.CONFIG_SECRET_KEY = 'isolated-commerce-studio-test-key';
    const orders = path.join(root, 'orders.csv'),
      payments = path.join(root, 'payments.csv'),
      refunds = path.join(root, 'refunds.csv');
    fs.writeFileSync(
      orders,
      'order_id,customer_id,ordered_at,order_status,currency,subtotal,tax_amount,shipping_amount,order_total\nK1,C1,2025-01-01T00:00:00Z,partially_refunded,KRW,10000,1000,1000,12000\nK2,C2,2025-01-01T00:00:00Z,completed,KRW,1000,0,0,1000\n',
    );
    fs.writeFileSync(
      payments,
      'payment_id,order_id,paid_at,payment_status,amount\nP1,K1,2025-01-01T01:00:00Z,succeeded,7000\nP2,K1,2025-01-02T01:00:00Z,succeeded,5000\nP3,K2,2025-01-01T01:00:00Z,succeeded,1000\n',
    );
    fs.writeFileSync(
      refunds,
      'refund_id,payment_id,order_id,refunded_at,refund_reason,amount\nR1,P1,K1,2025-01-03T00:00:00Z,return,1000\nR2,P2,K1,2025-01-04T00:00:00Z,return,1000\n',
    );
    worker = new DuckDBService();
    filename = (await worker.importCommerce({ files: { orders, payments, refunds } })).filename;
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [SourceCatalogEntry, CommerceSource, Database],
    }).initialize();
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    await db.getRepository(Database).clear();
    await db.getRepository(CommerceSource).save({
      id: 1,
      ownerId: 7,
      name: '원화 주문',
      status: 'ready',
      currentVersion: 1,
      publishedDigest: 'a'.repeat(64),
      publishedFilename: filename,
    });
    service = new CommerceStudioService(db, worker);
  });
  afterAll(async () => {
    await worker?.onModuleDestroy();
    await db?.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  it('shares parallel requests, preserves split payment/refund sums and reuses after restart', async () => {
    const initial = await db.getRepository(CommerceSource).findOneByOrFail({ id: 1 });
    const importSpy = jest.spyOn(worker, 'importCommerce');
    const [a, b] = await Promise.all([service.connect(7, 1), service.connect(7, 1)]);
    expect(a.data.sourceId).toBe(b.data.sourceId);
    expect(importSpy).toHaveBeenCalledTimes(1);
    const row = await db.getRepository(Database).findOneByOrFail({ id: a.data.sourceId });
    const config = JSON.parse(decryptConnectionConfig(row.connectionConfig));
    expect(row.ownerId).toBe(7);
    expect(row.connectionConfig).toMatch(/^enc:v1:/);
    expect(config.commerceSnapshot).toMatchObject({
      projectId: 1,
      version: 1,
      currency: 'KRW',
      timeBasis: 'order-cohort',
    });
    const data = (
      await worker.query(
        config.connection.filename,
        'SELECT COUNT(*) n, SUM(revenue) sales, SUM(refund_amount) refunds, SUM(net_amount) net, SUM(refunded_orders)*100.0/SUM(paid_orders) rate FROM uploaded_data',
      )
    ).datas[0];
    expect([data.n, data.sales, data.refunds, data.net, data.rate].map(Number)).toEqual([
      2, 13000, 2000, 11000, 50,
    ]);
    const replay = await new CommerceStudioService(db, worker).connect(7, 1);
    expect(replay.data.sourceId).toBe(a.data.sourceId);
    expect(importSpy).toHaveBeenCalledTimes(1);
    expect(await db.getRepository(CommerceSource).findOneByOrFail({ id: 1 })).toEqual(initial);
  });
  it('rejects other owners and unready sources before touching files', async () => {
    const spy = jest.spyOn(worker, 'importCommerce');
    await expect(service.connect(8, 1)).rejects.toMatchObject({ status: 403 });
    await db.getRepository(CommerceSource).update(1, { status: 'empty' });
    await expect(service.connect(7, 1)).rejects.toMatchObject({ status: 400 });
    expect(spy).not.toHaveBeenCalled();
    expect(await db.getRepository(Database).count()).toBe(0);
  });
  it('cleans up a derived file when the Commerce version changes during import', async () => {
    const real = worker.importCommerce.bind(worker);
    const discard = jest.spyOn(worker, 'discardImport');
    jest.spyOn(worker, 'importCommerce').mockImplementationOnce(async input => {
      const result = await real(input);
      await db.getRepository(CommerceSource).update(1, { currentVersion: 2 });
      return result;
    });
    await expect(service.connect(7, 1)).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(Database).count()).toBe(0);
    expect(discard).toHaveBeenCalledTimes(1);
  });
  it('creates a new source for a new version and leaves the old snapshot unchanged', async () => {
    const a = await service.connect(7, 1);
    const original = await db.getRepository(Database).findOneByOrFail({ id: a.data.sourceId });
    await db.getRepository(CommerceSource).update(1, { currentVersion: 2 });
    const b = await service.connect(7, 1);
    expect(b.data.sourceId).not.toBe(a.data.sourceId);
    expect(await db.getRepository(Database).findOneByOrFail({ id: a.data.sourceId })).toEqual(
      original,
    );
  });
  it('does not reuse a derived source whose file was replaced independently', async () => {
    const a = await service.connect(7, 1);
    const row = await db.getRepository(Database).findOneByOrFail({ id: a.data.sourceId });
    const config = JSON.parse(decryptConnectionConfig(row.connectionConfig));
    config.fileVersions.push({ ...config.fileVersions[0], id: 'replacement' });
    await db
      .getRepository(Database)
      .update(row.id, { connectionConfig: encryptConnectionConfig(JSON.stringify(config)) });
    const b = await service.connect(7, 1);
    expect(b.data.sourceId).not.toBe(a.data.sourceId);
  });
  it('recovers a committed source after a lost transaction response without deleting its file', async () => {
    const commit = db.transaction.bind(db);
    const discard = jest.spyOn(worker, 'discardImport');
    jest.spyOn(db, 'transaction').mockImplementationOnce(async (run: any) => {
      await commit(run);
      throw new Error('commit response lost /private/internal/path');
    });
    await expect(service.connect(7, 1)).rejects.toMatchObject({ status: 503 });
    expect(discard).not.toHaveBeenCalled();
    expect(await db.getRepository(Database).count()).toBe(1);
    const retry = await service.connect(7, 1);
    expect(retry.data.sourceId).toBe((await db.getRepository(Database).find())[0].id);
    expect(await db.getRepository(Database).count()).toBe(1);
  });
  it('cleans up after a transaction callback succeeded but the commit rolled back', async () => {
    const transaction = db.transaction.bind(db);
    const discard = jest.spyOn(worker, 'discardImport');
    jest.spyOn(db, 'transaction').mockImplementationOnce((run: any) =>
      transaction(async manager => {
        await run(manager);
        throw new Error('rollback after insert');
      }),
    );
    await expect(service.connect(7, 1)).rejects.toMatchObject({ status: 503 });
    expect(await db.getRepository(Database).count()).toBe(0);
    expect(discard).toHaveBeenCalledTimes(1);
  });
  it('keeps curated currency errors as400 without returning filesystem details', async () => {
    jest.spyOn(worker, 'query').mockResolvedValueOnce({ datas: [{ currency: 'EUR' }] } as any);
    await expect(service.connect(7, 1)).rejects.toMatchObject({ status: 400 });
    expect(await db.getRepository(Database).count()).toBe(0);
  });
  it('keeps different project requests independent and returns no internal file paths', async () => {
    const first = await db.getRepository(CommerceSource).findOneByOrFail({ id: 1 });
    await db.getRepository(CommerceSource).save({ ...first, id: 2 });
    const [a, b] = await Promise.all([service.connect(7, 1), service.connect(7, 2)]);
    expect(a.data.sourceId).not.toBe(b.data.sourceId);
    expect(a.data.commerceProjectId).toBe(1);
    expect(b.data.commerceProjectId).toBe(2);
    expect(JSON.stringify(a)).not.toContain(root);
    expect(JSON.stringify(a)).not.toContain('filename');
  });
});
