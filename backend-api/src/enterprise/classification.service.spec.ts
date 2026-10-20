import { randomUUID, createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import {
  EnterpriseClassification,
  EnterpriseClassificationRequest,
} from './entities/enterprise-classification.entity';
import { EnterpriseClassificationService, classificationName } from './classification.service';
import { classificationContext, assertClassificationContext } from './classification-context';
import { AddEnterpriseClassifications1792580000000 } from '../migrations/1792580000000-add-enterprise-classifications';

const entities = [
  User,
  EnterpriseMembership,
  EnterpriseAuditEvent,
  EnterpriseClassification,
  EnterpriseClassificationRequest,
];
describe('Organization classification registry', () => {
  let db: DataSource, service: EnterpriseClassificationService;
  const body = (name = 'Operations', actor = 1, org = 10) => ({
    expectedActorId: actor,
    expectedOrganizationId: org,
    requestId: randomUUID(),
    name,
  });
  const change = (name = 'Operations', version = 1, active = true) => ({
    expectedActorId: 1,
    expectedOrganizationId: 10,
    expectedVersion: version,
    name,
    active,
  });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
    await db.manager.save(
      User,
      [1, 2, 3, 4].map(id => ({
        id,
        userId: 'registry-' + id,
        email: `registry-${id}@example.invalid`,
        password: 'unused',
      })),
    );
    await db.manager.save(EnterpriseMembership, [
      { userId: 1, organizationId: 10, role: 'admin', team: '' },
      { userId: 2, organizationId: 10, role: 'member', team: '' },
      { userId: 3, organizationId: 20, role: 'admin', team: '' },
    ]);
    service = new EnterpriseClassificationService(db);
  });
  afterEach(async () => {
    await db.destroy();
  });
  it('normalizes NFKC then trims and hashes lowercase UTF8 with equality independent of collation', async () => {
    const result = await service.create(1, 0, body('  ＯＰＳ  '));
    expect(result).toEqual({
      actorId: 1,
      organizationId: 10,
      entry: { id: expect.any(Number), name: 'OPS', active: true, version: 1 },
      replayed: false,
    });
    const row = await db.manager.findOneByOrFail(EnterpriseClassification, { id: result.entry.id });
    expect(row.nameKey).toBe(createHash('sha256').update('ops').digest('hex'));
    await expect(service.create(1, 0, body('ops'))).rejects.toMatchObject({ status: 409 });
    expect((await service.create(3, 0, body('ops', 3, 20))).entry.name).toBe('ops');
    expect(await db.manager.count(EnterpriseClassificationRequest)).toBe(2);
  });
  it.each(['', '   ', 'x'.repeat(81), 'bad\n', '\u0000name', '\ud800'])(
    'rejects invalid names %j before mutation',
    async name => {
      await expect(service.create(1, 0, body(name))).rejects.toMatchObject({ status: 400 });
      expect(await db.manager.count(EnterpriseClassification)).toBe(0);
    },
  );
  it('accepts 80 normalized Unicode characters and rejects incompatible shapes/UUID/authVersion injection', async () => {
    expect(classificationName('é'.repeat(80)).name).toHaveLength(80);
    expect(classificationName('😀'.repeat(40)).name).toHaveLength(80);
    expect(() => classificationName('😀'.repeat(41))).toThrow();
    for (const input of [
      { ...body(), requestId: 'x' },
      { ...body(), authVersion: 0 },
      { ...body(), expectedActorId: 0 },
      { ...body(), expectedOrganizationId: null },
      { ...body(), requestId: randomUUID().toUpperCase() },
    ])
      await expect(service.create(1, 0, input)).rejects.toMatchObject({ status: 400 });
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(0);
  });
  it('returns only current org metadata to members and pages 20 with a cursor including inactive entries', async () => {
    for (let i = 0; i < 22; i += 1) await service.create(1, 0, body('Class ' + i));
    const other = await service.create(3, 0, body('Other organization', 3, 20));
    const first = await service.list(2, 0);
    expect(first).toMatchObject({ actorId: 2, organizationId: 10, canManage: false });
    expect(first.entries).toHaveLength(20);
    expect(first.nextAfterId).toBe(first.entries[19].id);
    const last = await service.list(2, 0, first.nextAfterId);
    expect(last.entries).toHaveLength(2);
    expect(last.nextAfterId).toBeNull();
    expect(first.entries.some(e => e.id === other.entry.id)).toBe(false);
    expect(Object.keys(first.entries[0]).sort()).toEqual(['active', 'id', 'name', 'version']);
    await expect(service.list(1, 0, '1')).rejects.toMatchObject({ status: 400 });
    await service.set(first.entries[0].id, 1, 0, change('Class 0', 1, false));
    expect((await service.list(2, 0)).entries[0].active).toBe(false);
  });
  it('does not grant write authority to a reader or unaffiliated/inactive actor', async () => {
    await expect(service.create(2, 0, body('Reader', 2))).rejects.toMatchObject({ status: 403 });
    await expect(service.list(4, 0)).rejects.toMatchObject({ status: 403 });
    await db.manager.update(User, 1, { active: false });
    await expect(service.list(1, 0)).rejects.toMatchObject({ status: 403 });
    await expect(service.create(1, 0, body())).rejects.toMatchObject({ status: 403 });
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(0);
  });
  it('fences expected actor and organization and never returns another organization entry', async () => {
    const other = await service.create(3, 0, body('Private organization name', 3, 20));
    await expect(service.create(1, 0, body('Wrong actor', 3))).rejects.toMatchObject({
      status: 409,
    });
    await expect(service.create(1, 0, body('Wrong org', 1, 20))).rejects.toMatchObject({
      status: 409,
    });
    const error = await service.set(other.entry.id, 1, 0, change()).catch(e => e);
    expect(error.status).toBe(403);
    expect(JSON.stringify(error)).not.toContain(other.entry.name);
    expect((await service.list(1, 0)).entries).toEqual([]);
  });
  it('commits exactly one row/audit/receipt for concurrent same UUID, and replays frozen creation after edits', async () => {
    const request = body();
    const [a, b] = await Promise.all([
      service.create(1, 0, request),
      service.create(1, 0, { ...request }),
    ]);
    expect(a.entry).toEqual(b.entry);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    await service.set(a.entry.id, 1, 0, change('Renamed', 1, false));
    expect(await service.create(1, 0, { ...request, name: '  Operations  ' })).toEqual({
      ...a,
      replayed: true,
    });
    await expect(service.create(1, 0, { ...request, name: 'Different' })).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.manager.count(EnterpriseClassification)).toBe(1);
    expect(await db.manager.count(EnterpriseClassificationRequest)).toBe(1);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(2);
  });
  it.each([
    'json',
    'extra',
    'actor',
    'org',
    'array',
    'entry-extra',
    'id',
    'name',
    'active',
    'version',
  ])(
    'rejects corrupt creation receipt %s without exposing fields or mutating',
    async corruption => {
      const request = body();
      const made = await service.create(1, 0, request);
      const receipt = await db.manager.findOneByOrFail(EnterpriseClassificationRequest, {
        actorId: 1,
        requestId: request.requestId,
      });
      const stored = JSON.parse(receipt.result);
      if (corruption === 'extra') stored.privateSource = 'private payload';
      if (corruption === 'actor') stored.actorId = 2;
      if (corruption === 'org') stored.organizationId = 20;
      if (corruption === 'array') stored.entry = [];
      if (corruption === 'entry-extra') stored.entry.privateSource = 'private payload';
      if (corruption === 'id') stored.entry.id = 0;
      if (corruption === 'name') stored.entry.name = 'Other private name';
      if (corruption === 'active') stored.entry.active = false;
      if (corruption === 'version') stored.entry.version = 2;
      await db.manager.update(
        EnterpriseClassificationRequest,
        { actorId: 1, requestId: request.requestId },
        { result: corruption === 'json' ? 'not json' : JSON.stringify(stored) },
      );
      const error = await service.create(1, 0, request).catch(e => e);
      expect(error.status).toBe(409);
      expect(JSON.stringify(error)).not.toMatch(/private payload|Other private name/);
      expect(await db.manager.count(EnterpriseClassificationRequest)).toBe(1);
      expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
      expect((await service.list(1, 0)).entries).toEqual([made.entry]);
    },
  );
  it('blocks same UUID after org transition even if expected scope is updated', async () => {
    const request = body();
    await service.create(1, 0, request);
    await db.manager.update(EnterpriseMembership, 1, { organizationId: 20 });
    await expect(service.create(1, 0, request)).rejects.toMatchObject({ status: 409 });
    await expect(
      service.create(1, 0, { ...request, expectedOrganizationId: 20 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(EnterpriseClassification)).toBe(1);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
  });
  it('CAS rejects future/stale versions before mutation; no-op writes nothing; max version cannot increment', async () => {
    const made = await service.create(1, 0, body());
    await expect(service.set(made.entry.id, 1, 0, change('New', 2))).rejects.toMatchObject({
      status: 409,
    });
    expect(await service.set(made.entry.id, 1, 0, change())).toEqual({
      actorId: 1,
      organizationId: 10,
      entry: made.entry,
    });
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
    const changed = await service.set(made.entry.id, 1, 0, change('New', 1, false));
    expect(changed.entry.version).toBe(2);
    await expect(service.set(made.entry.id, 1, 0, change('Old', 1))).rejects.toMatchObject({
      status: 409,
    });
    await db.manager.update(EnterpriseClassification, made.entry.id, { version: 2147483647 });
    await expect(
      service.set(made.entry.id, 1, 0, change('Beyond', 2147483647)),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(2);
  });
  it('reserves inactive names and rolls back duplicate rename without consuming version or audit', async () => {
    const a = await service.create(1, 0, body('A'));
    const b = await service.create(1, 0, body('B'));
    await service.set(a.entry.id, 1, 0, change('A', 1, false));
    await expect(service.create(1, 0, body('a'))).rejects.toMatchObject({ status: 409 });
    await expect(service.set(b.entry.id, 1, 0, change('Ａ', 1))).rejects.toMatchObject({
      status: 409,
    });
    expect((await service.list(1, 0)).entries.find(e => e.id === b.entry.id).version).toBe(1);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(3);
  });
  it('rolls back row and receipt if atomic audit insertion fails', async () => {
    await db.query(
      `CREATE TRIGGER fail_classification_audit BEFORE INSERT ON enterprise_audit_event BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END`,
    );
    await expect(service.create(1, 0, body())).rejects.toThrow('synthetic audit failure');
    expect(await db.manager.count(EnterpriseClassification)).toBe(0);
    expect(await db.manager.count(EnterpriseClassificationRequest)).toBe(0);
    await db.query('DROP TRIGGER fail_classification_audit');
    const a = await service.create(1, 0, body());
    await db.query(
      `CREATE TRIGGER fail_classification_audit BEFORE INSERT ON enterprise_audit_event BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END`,
    );
    await expect(service.set(a.entry.id, 1, 0, change('Changed'))).rejects.toThrow(
      'synthetic audit failure',
    );
    expect((await service.list(1, 0)).entries[0]).toEqual(a.entry);
  });
  it.each(['list', 'create', 'set'] as const)(
    'rechecks trusted epoch after queued %s enters metadata work',
    async operation => {
      const a = await service.create(1, 0, body());
      let entered: () => void, release: () => void;
      const ready = new Promise<void>(r => {
        entered = r;
      });
      const held = new Promise<void>(r => {
        release = r;
      });
      const blocker = serializeMetadataWork(db, async () => {
        entered();
        await held;
        await db.manager.update(User, 1, { authVersion: 1 });
      });
      await ready;
      const pending =
        operation === 'list'
          ? service.list(1, 0)
          : operation === 'create'
          ? service.create(1, 0, body('queued'))
          : service.set(a.entry.id, 1, 0, change('queued'));
      const assertion = expect(pending).rejects.toMatchObject({ status: 401 });
      release();
      await blocker;
      await assertion;
      expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
    },
  );
  it.each(
    (['create', 'set'] as const).flatMap(operation =>
      (['org', 'role', 'active'] as const).map(change => ({ operation, change })),
    ),
  )(
    'rejects queued $operation after $change changes before mutation',
    async ({ operation, change: state }) => {
      const made = await service.create(1, 0, body());
      let entered: () => void, release: () => void;
      const ready = new Promise<void>(resolve => {
        entered = resolve;
      });
      const held = new Promise<void>(resolve => {
        release = resolve;
      });
      const blocker = serializeMetadataWork(db, async () => {
        entered();
        await held;
        if (state === 'active') await db.manager.update(User, 1, { active: false });
        else
          await db.manager.update(
            EnterpriseMembership,
            1,
            state === 'org' ? { organizationId: 20 } : { role: 'member' },
          );
      });
      await ready;
      const pending =
        operation === 'create'
          ? service.create(1, 0, body('Queued'))
          : service.set(made.entry.id, 1, 0, change('Queued'));
      const rejected = expect(pending).rejects.toMatchObject({
        status: state === 'org' ? 409 : 403,
      });
      release();
      await blocker;
      await rejected;
      expect(await db.manager.count(EnterpriseClassification)).toBe(1);
      expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
      expect(await db.manager.count(EnterpriseClassificationRequest)).toBe(1);
    },
  );
  it('allows one concurrent CAS winner and one audit without overwriting that winner', async () => {
    const made = await service.create(1, 0, body());
    const results = await Promise.allSettled([
      service.set(made.entry.id, 1, 0, change('First')),
      service.set(made.entry.id, 1, 0, change('Second')),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    expect((await service.list(1, 0)).entries[0]).toMatchObject({ name: 'First', version: 2 });
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(2);
  });
  it('checks current org and admin role and rejects stale snapshot helpers', async () => {
    const scope = await classificationContext(db.manager, { id: 1, authVersion: 0 });
    expect(scope).toEqual({ actorId: 1, organizationId: 10, canManage: true, authVersion: 0 });
    await metadataTransaction(db, async manager => {
      await manager.update(EnterpriseMembership, 1, { organizationId: 20 });
    });
    await expect(assertClassificationContext(db.manager, { id: 1 }, scope)).rejects.toMatchObject({
      status: 409,
    });
    await db.manager.update(EnterpriseMembership, 1, { role: 'member' });
    await expect(service.create(1, 0, body('Role', 1, 20))).rejects.toMatchObject({ status: 403 });
  });
  it('migration is additive and repeatable and preserves equality/receipts', async () => {
    const raw = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
    const runner = raw.createQueryRunner();
    const migration = new AddEnterpriseClassifications1792580000000();
    try {
      await migration.up(runner);
      await migration.up(runner);
      await raw.query(
        'INSERT INTO enterprise_classification (organizationId,name,nameKey,active,version) VALUES (?,?,?,?,?)',
        [10, 'A', 'a'.repeat(64), false, 4],
      );
      await expect(
        raw.query(
          'INSERT INTO enterprise_classification (organizationId,name,nameKey,active,version) VALUES (?,?,?,?,?)',
          [10, 'a', 'a'.repeat(64), true, 1],
        ),
      ).rejects.toThrow();
      await raw.query(
        'INSERT INTO enterprise_classification_request (actorId,requestId,organizationId,payloadHash,result) VALUES (?,?,?,?,?)',
        [1, randomUUID(), 10, 'b'.repeat(64), 'immutable outcome'],
      );
      await migration.up(runner);
      expect((await raw.query('SELECT result FROM enterprise_classification_request'))[0]).toEqual({
        result: 'immutable outcome',
      });
      expect(
        (await raw.query('SELECT name,version,active FROM enterprise_classification'))[0],
      ).toEqual({ name: 'A', version: 4, active: 0 });
      await expect(migration.down()).rejects.toThrow('backup');
    } finally {
      await runner.release();
      await raw.destroy();
    }
  });
});
