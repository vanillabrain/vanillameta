jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { ChildProcess, fork } from 'child_process';
import { once } from 'events';
import { randomUUID, createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { exportRestartEntities } from '../../test/fixtures/export-jobs-restart-child';
import { ExportJob, ExportPart } from './entities/export-job.entity';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';

class Host {
  readonly child: ChildProcess;
  private id = 0;
  private pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }
  >();
  private events: any[] = [];
  constructor(root: string) {
    const fixture = path.resolve(__dirname, '../../test/fixtures/export-jobs-restart-child.ts');
    const launcher =
      "require('ts-node').register({transpileOnly:true,experimentalResolver:true});require('tsconfig-paths/register');require(process.argv[1]).main().catch(e=>{process.send({event:'fatal',kind:e.name,code:e.code});process.exitCode=1;});";
    this.child = fork('-e', [launcher, fixture], {
      cwd: path.resolve(__dirname, '../..'),
      execArgv: [],
      env: { ...process.env, FILE_UPLOAD_DIR: root },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    this.child.on('message', (m: any) => {
      if (m.event) this.events.push(m);
      else {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        clearTimeout(p.timer);
        if (m.error)
          p.reject(Object.assign(new Error('Fixture service rejected request'), m.error));
        else p.resolve(m.value);
      }
    });
    this.child.on('exit', () => {
      for (const p of this.pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error('Fixture child exited'));
      }
      this.pending.clear();
    });
  }
  async event(name: string) {
    for (let i = 0; i < 400; i++) {
      const fatal = this.events.find(e => e.event === 'fatal');
      if (fatal) throw new Error(`Child fixture failed: ${fatal.kind}/${fatal.code ?? 'unknown'}`);
      const index = this.events.findIndex(e => e.event === name);
      if (index >= 0) return this.events.splice(index, 1)[0];
      if (this.child.exitCode !== null || this.child.signalCode)
        throw new Error('Fixture child exited before event');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`Missing child event ${name}`);
  }
  call(op: string, args: any = {}): Promise<any> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Fixture IPC timeout'));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.send({ id, op, args });
    });
  }
  async kill() {
    if (this.child.exitCode !== null || this.child.signalCode) return;
    const exited = once(this.child, 'exit');
    this.child.kill('SIGKILL');
    await exited;
    expect(this.child.signalCode).toBe('SIGKILL');
  }
}
const suite = process.env.VM_SEMANTIC_MYSQL_CONFIG ? describe : describe.skip;
suite('UC054 actual OS export process restart with owned MySQL and native DuckDB', () => {
  jest.setTimeout(45000);
  let db: DataSource, root: string, hosts: Host[], a: Host, body: any;
  const host = async () => {
    const h = new Host(root);
    hosts.push(h);
    const ready = await h.event('ready');
    expect(ready.pid).toBe(h.child.pid);
    return h;
  };
  const snapshots = (all = false) =>
    Promise.all(
      (all ? exportRestartEntities : [ExportJob, ExportPart, EnterpriseAuditEvent]).map(e =>
        db.getRepository(e).find({
          order: Object.fromEntries(
            db.getMetadata(e).primaryColumns.map(c => [c.propertyName, 'ASC']),
          ),
        }),
      ),
    );
  const create = (h: Host) => h.call('create', { body: { ...body, requestId: randomUUID() } });
  const audits = (id: number, action: string) =>
    db.manager.countBy(EnterpriseAuditEvent, { resourceId: id, action: `export.${action}` });
  beforeAll(async () => {
    db = await semanticMetadata('runtime', {
      type: 'sqlite',
      database: ':memory:',
      entities: exportRestartEntities,
    });
  });
  beforeEach(async () => {
    for (const e of [...exportRestartEntities].reverse())
      await db.getRepository(e).createQueryBuilder().delete().execute();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'export-restart-process-'));
    hosts = [];
    a = await host();
    body = await a.call('seed');
  });
  afterEach(async () => {
    await Promise.all(hosts.map(h => h.kill()));
    fs.rmSync(root, { recursive: true, force: true });
    expect(fs.existsSync(root)).toBe(false);
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  it('SIGKILL/new PID preserves queued/ready, never auto-starts, reads interrupted without writes, and explicitly retries once across two processes', async () => {
    const queued = await create(a),
      readyJob = await create(a),
      running = await create(a);
    const firstRun = await a.call('run', { id: readyJob.id, version: 1 });
    expect(firstRun.status).toBe('ready');
    const originalFile = await a.call('file', { id: readyJob.id });
    await a.call('arm');
    await a.call('run', { id: running.id, version: 1, background: true });
    await a.event('aggregate-held');
    const beforeKill = await snapshots(true);
    const oldPid = a.child.pid;
    await a.kill();
    const b = await host();
    expect(b.child.pid).not.toBe(oldPid);
    expect(await snapshots(true)).toEqual(beforeKill);
    expect((await b.call('get', { id: queued.id })).status).toBe('queued');
    expect((await b.call('get', { id: readyJob.id })).status).toBe('ready');
    expect((await b.call('get', { id: running.id })).status).toBe('running');
    expect(await b.call('file', { id: readyJob.id })).toEqual(originalFile);
    expect(await b.call('stats')).toMatchObject({ aggregates: 0, queries: 0 });
    expect(await snapshots(true)).toEqual(beforeKill);
    // Test DB fixture acceleration only: production LEASE remains five minutes; no clock/backdoor change.
    await db.manager.update(ExportJob, running.id, { leaseUntil: new Date(Date.now() - 1000) });
    const expired = await snapshots(true);
    const interrupted = await b.call('get', { id: running.id });
    expect(interrupted.status).toBe('interrupted');
    await b.call('list');
    expect(await snapshots(true)).toEqual(expired);
    expect(await b.call('stats')).toMatchObject({ aggregates: 0, queries: 0 });
    const c = await host();
    expect(c.child.pid).not.toBe(b.child.pid);
    await b.call('arm');
    const claimed = await b.call('run', {
      id: running.id,
      version: interrupted.version,
      background: true,
    });
    await b.event('aggregate-held');
    const duplicate = await c.call('run', {
      id: running.id,
      version: interrupted.version,
      background: true,
    });
    expect(duplicate.status).toBe('running');
    expect(duplicate.version).toBe(claimed.version);
    expect(await c.call('stats')).toMatchObject({ aggregates: 0, queries: 0 });
    await b.call('release');
    await b.call('drain');
    expect((await c.call('get', { id: running.id })).status).toBe('ready');
    const file = await c.call('file', { id: running.id });
    expect(file.sha256).toBe(originalFile.sha256);
    expect(file.csv).toBe(originalFile.csv);
    const parts = await db.manager.find(ExportPart, {
      where: { jobId: running.id },
      order: { part: 'ASC' },
    });
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map(p => p.part)).toEqual(parts.map((_, i) => i));
    expect(parts.map(p => p.data).join('')).toBe(file.csv);
    expect(Buffer.byteLength(file.csv)).toBe(file.bytes);
    expect(createHash('sha256').update(file.csv).digest('hex')).toBe(file.sha256);
    expect(await audits(running.id, 'queued')).toBe(1);
    expect(await audits(running.id, 'running')).toBe(2);
    expect(await audits(running.id, 'ready')).toBe(1);
    expect((await b.call('get', { id: queued.id })).status).toBe('queued');
    const final = await snapshots(true);
    await b.call('run', { id: running.id, version: claimed.version });
    expect(await snapshots(true)).toEqual(final);
    expect(await b.call('stats')).toMatchObject({ aggregates: 1 });
    console.info(
      JSON.stringify({
        phase: 'restart-proof',
        oldPid,
        newPid: b.child.pid,
        peerPid: c.child.pid,
        sigkill: true,
        parts: parts.length,
        leaseAcceleration: 'fixture SQL leaseUntil only',
        readyAudits: 1,
      }),
    );
  });
  it('reconnected reads and run/create enforce current export permission, source identity and JWT epoch', async () => {
    const job = await create(a);
    const ready = await a.call('run', { id: job.id, version: 1 });
    const file = await a.call('file', { id: job.id });
    await a.kill();
    const b = await host();
    const before = await snapshots();
    await db.manager.update(
      EnterpriseResourceGrant,
      { resourceKind: 'source', resourceId: 1, recipientId: 8 },
      { export: false },
    );
    for (const op of ['get', 'file'])
      await expect(b.call(op, { id: job.id })).rejects.toMatchObject({ status: 403 });
    expect((await b.call('list')).entries).toEqual([]);
    await db.manager.update(
      EnterpriseResourceGrant,
      { resourceKind: 'source', resourceId: 1, recipientId: 8 },
      { export: true },
    );
    await db.manager.update(User, 8, { authVersion: 1 });
    for (const op of ['get', 'file', 'run'])
      await expect(
        b.call(op, { id: job.id, version: ready.version, epoch: 0 }),
      ).rejects.toMatchObject({ status: 401 });
    await expect(
      b.call('create', { body: { ...body, requestId: randomUUID() }, epoch: 0 }),
    ).rejects.toMatchObject({ status: 401 });
    expect((await b.call('file', { id: job.id, epoch: 1 })).sha256).toBe(file.sha256);
    await db.manager.update(Database, 1, { catalogActive: false });
    await expect(b.call('file', { id: job.id, epoch: 1 })).rejects.toMatchObject({ status: 403 });
    await db.manager.update(Database, 1, { catalogActive: true, ownerId: 9 });
    await expect(b.call('file', { id: job.id, epoch: 1 })).rejects.toMatchObject({ status: 403 });
    expect(await snapshots()).toEqual(before);
    expect(await b.call('stats')).toMatchObject({ aggregates: 0, queries: 0 });
  });
  it('expiration between checked basis and ready CAS rolls back real parts and ready audit', async () => {
    const job = await create(a);
    const expiresAt = new Date(Date.now() + 4000);
    // Test fixture shortens TTL only. The real clock and production constants remain unchanged.
    await db.manager.update(ExportJob, job.id, { expiresAt });
    await a.call('armParts');
    await a.call('run', { id: job.id, version: 1, background: true });
    await a.event('parts-held');
    await new Promise(resolve =>
      setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 50)),
    );
    await a.call('release');
    await a.call('drain');
    expect(await db.manager.findOneBy(ExportJob, { id: job.id })).toMatchObject({
      status: 'failed',
      partCount: 0,
    });
    expect(await db.manager.countBy(ExportPart, { jobId: job.id })).toBe(0);
    expect(await audits(job.id, 'ready')).toBe(0);
    expect(await audits(job.id, 'failed')).toBe(1);
  });
  it.each(['complete-first', 'revoke-first'])(
    'actual group export policy writer serializes with final publication: %s',
    async order => {
      await db.manager.insert(EnterpriseGroup, {
        id: 80,
        organizationId: 1,
        name: 'Restart group',
        nameKey: 'restart-group',
        active: true,
        version: 1,
      });
      await db.manager.insert(EnterpriseGroupMember, { groupId: 80, userId: 8 });
      const rights = (enabled: boolean) => ({
        read: enabled,
        edit: false,
        publish: false,
        export: enabled,
      });
      await a.call('groupPolicy', {
        body: {
          groupId: 80,
          expectedGroupVersion: 1,
          expectedVersion: 0,
          rights: rights(true),
        },
      });
      await a.call('directPolicy', {
        body: {
          recipientId: 8,
          expectedVersion: 1,
          rights: rights(false),
        },
      });
      const job = await create(a);
      await a.kill();
      const b = await host(),
        c = await host();
      await b.call(order === 'complete-first' ? 'armParts' : 'arm');
      await b.call('run', { id: job.id, version: 1, background: true });
      await b.event(order === 'complete-first' ? 'parts-held' : 'aggregate-held');
      let settled = false;
      const revoke = c
        .call('groupPolicy', {
          body: {
            groupId: 80,
            expectedGroupVersion: 1,
            expectedVersion: 1,
            rights: rights(false),
          },
        })
        .then(
          value => {
            settled = true;
            return { value };
          },
          error => {
            settled = true;
            return { error };
          },
        );
      if (order === 'complete-first') {
        // Actual second connection must wait on the shared Source parent, not actor User8.
        let waiting: any[] = [];
        for (let i = 0; i < 100 && !waiting.length; i++) {
          waiting = await db.query(`SELECT requested.OBJECT_NAME AS tableName
            FROM performance_schema.data_lock_waits waits
            JOIN performance_schema.data_locks requested
              ON requested.ENGINE_LOCK_ID = waits.REQUESTING_ENGINE_LOCK_ID
              AND requested.ENGINE = waits.ENGINE
            WHERE requested.OBJECT_NAME = 'database'`);
          if (!waiting.length) await new Promise(resolve => setTimeout(resolve, 25));
        }
        expect(waiting.length).toBeGreaterThan(0);
        expect(settled).toBe(false);
      } else {
        expect(await revoke).not.toHaveProperty('error');
      }
      await b.call('release');
      await b.call('drain');
      expect(await revoke).not.toHaveProperty('error');
      const stored = await db.manager.findOneBy(ExportJob, { id: job.id });
      const parts = await db.manager.find(ExportPart, {
        where: { jobId: job.id },
        order: { part: 'ASC' },
      });
      if (order === 'complete-first') {
        expect(stored.status).toBe('ready');
        expect(parts.length).toBeGreaterThan(1);
        const csv = parts.map(part => part.data).join('');
        expect(createHash('sha256').update(csv).digest('hex')).toBe(stored.hash);
        expect(Buffer.byteLength(csv)).toBe(stored.bytes);
        expect(await audits(job.id, 'ready')).toBe(1);
        expect(await audits(job.id, 'failed')).toBe(0);
      } else {
        expect(stored).toMatchObject({
          status: 'failed',
          errorCode: 'ACCESS_REVOKED',
          partCount: 0,
        });
        expect(parts).toHaveLength(0);
        expect(await audits(job.id, 'ready')).toBe(0);
        expect(await audits(job.id, 'failed')).toBe(1);
      }
      await expect(b.call('file', { id: job.id })).rejects.toMatchObject({ status: 403 });
      console.info(
        JSON.stringify({
          phase: 'group-source-publication-race',
          order,
          readyAudits: order === 'complete-first' ? 1 : 0,
          parts: parts.length,
        }),
      );
    },
  );
  it.each(['epoch', 'permission'])(
    'after restart, %s revocation during a held aggregate prevents ready/parts and records one failed attempt',
    async change => {
      const job = await create(a);
      await a.kill();
      const b = await host();
      await b.call('arm');
      await b.call('run', { id: job.id, version: 1, background: true });
      await b.event('aggregate-held');
      if (change === 'epoch') await db.manager.update(User, 8, { authVersion: 1 });
      else
        await db.manager.update(
          EnterpriseResourceGrant,
          { resourceKind: 'source', resourceId: 1, recipientId: 8 },
          { export: false },
        );
      await b.call('release');
      await b.call('drain');
      expect(await db.manager.findOneBy(ExportJob, { id: job.id })).toMatchObject({
        status: 'failed',
        errorCode: 'ACCESS_REVOKED',
        partCount: 0,
      });
      expect(await db.manager.countBy(ExportPart, { jobId: job.id })).toBe(0);
      expect(await audits(job.id, 'ready')).toBe(0);
      expect(await audits(job.id, 'failed')).toBe(1);
      expect(await b.call('stats')).toMatchObject({ aggregates: 1 });
    },
  );
});
