import { DataSource, QueryRunner } from 'typeorm';
import { AddEnterpriseResourceGrants1792410000000 } from '../migrations/1792410000000-add-enterprise-resource-grants';

const COLUMNS = [
  'resourceKind',
  'resourceId',
  'recipientId',
  'organizationId',
  'ownerId',
  'version',
  'read',
  'edit',
  'publish',
  'export',
];
const KEYS = ['resourceKind', 'resourceId', 'recipientId'];

/**
 * UC-051 resource-grant migration: additive on a legacy or empty schema, idempotent, and
 * fail-closed on rollback so an operator cannot drop live grants silently.
 */
describe('AddEnterpriseResourceGrants1792410000000', () => {
  let db: DataSource;
  let runner: QueryRunner;
  const migration = new AddEnterpriseResourceGrants1792410000000();

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: false,
      entities: [],
    }).initialize();
    runner = db.createQueryRunner();
  });

  afterAll(async () => {
    await runner?.release();
    await db?.destroy();
  });

  const legacyAudit = () =>
    runner.query(
      'CREATE TABLE "enterprise_audit_event" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, ' +
        '"organizationId" integer NOT NULL, "actorId" integer NOT NULL, "action" varchar(40) NOT NULL, ' +
        '"resourceId" integer NOT NULL, "version" integer NOT NULL, "createdAt" datetime NOT NULL)',
    );

  it('creates the grant table on an empty database, stays idempotent and leaves other tables alone', async () => {
    await migration.up(runner);
    expect(await runner.hasTable('enterprise_resource_grant')).toBe(true);
    expect(await runner.hasTable('enterprise_audit_event')).toBe(false);

    await migration.up(runner);

    const columns = await runner.query('PRAGMA table_info("enterprise_resource_grant")');
    expect(columns.map((column: { name: string }) => column.name)).toEqual(COLUMNS);
    const keys = columns
      .filter((column: { pk: number }) => column.pk > 0)
      .map((column: { name: string }) => column.name);
    expect(keys).toHaveLength(KEYS.length);
    expect(new Set(keys)).toEqual(new Set(KEYS));
    const indexes = await runner.query('PRAGMA index_list("enterprise_resource_grant")');
    expect(indexes.map((index: { name: string }) => index.name)).toContain(
      'IDX_enterprise_grant_recipient',
    );
  });

  it('adds a nullable subjectId to a legacy audit table without rewriting existing rows', async () => {
    await legacyAudit();
    await runner.query(
      'INSERT INTO enterprise_audit_event (organizationId, actorId, action, resourceId, version, createdAt) ' +
        "VALUES (?,?,?,?,?,datetime('now'))",
      [1, 1, 'organization.created', 1, 1],
    );

    await migration.up(runner);

    expect(await runner.hasColumn('enterprise_audit_event', 'subjectId')).toBe(true);
    expect(await runner.hasTable('enterprise_resource_grant')).toBe(true);
    const [legacy] = await runner.query(
      'SELECT id, action, subjectId FROM enterprise_audit_event ORDER BY id ASC',
    );
    expect(Number(legacy.id)).toBe(1);
    expect(legacy.action).toBe('organization.created');
    expect(legacy.subjectId).toBeNull();

    await runner.query(
      'INSERT INTO enterprise_audit_event (organizationId, actorId, action, resourceId, subjectId, version, createdAt) ' +
        "VALUES (?,?,?,?,?,?,datetime('now'))",
      [1, 1, 'source.permissions', 101, 2, 1],
    );
    await migration.up(runner);
    const rows = await runner.query('SELECT subjectId FROM enterprise_audit_event ORDER BY id ASC');
    expect(
      rows.map((row: { subjectId: number | null }) =>
        row.subjectId === null ? null : Number(row.subjectId),
      ),
    ).toEqual([null, 2]);
  });

  it('defaults every right to false and keys grants on kind, resource and recipient', async () => {
    await migration.up(runner);
    const insert = (values: unknown[]) =>
      runner.query(
        `INSERT INTO enterprise_resource_grant (${COLUMNS.slice(0, 6).join(
          ', ',
        )}) VALUES (?,?,?,?,?,?)`,
        values,
      );

    await insert(['source', 101, 2, 1, 1, 1]);
    const [row] = await runner.query('SELECT * FROM enterprise_resource_grant');
    expect([row.read, row.edit, row.publish, row.export].map(Number)).toEqual([0, 0, 0, 0]);
    expect(Number(row.version)).toBe(1);

    await insert(['dashboard', 101, 2, 1, 1, 1]);
    const kinds = await runner.query(
      'SELECT resourceKind FROM enterprise_resource_grant ORDER BY resourceKind ASC',
    );
    expect(kinds.map((entry: { resourceKind: string }) => entry.resourceKind)).toEqual([
      'dashboard',
      'source',
    ]);

    await expect(insert(['source', 101, 2, 1, 1, 2])).rejects.toThrow();
    const [total] = await runner.query('SELECT COUNT(*) AS total FROM enterprise_resource_grant');
    expect(Number(total.total)).toBe(2);
  });

  it('refuses the destructive rollback while the schema stays in place', async () => {
    await migration.up(runner);
    await expect(migration.down()).rejects.toThrow(/backup plan/);
    expect(await runner.hasTable('enterprise_resource_grant')).toBe(true);
    expect(await runner.hasColumn('enterprise_audit_event', 'subjectId')).toBe(true);
  });
  it('preserves legacy publication rows while adding private publisher and source identity', async () => {
    await runner.query(
      'CREATE TABLE dashboard_publication (dashboardId integer PRIMARY KEY, snapshot text NOT NULL)',
    );
    await runner.query('INSERT INTO dashboard_publication (dashboardId,snapshot) VALUES (?,?)', [
      51,
      'synthetic snapshot',
    ]);
    await migration.up(runner);
    await migration.up(runner);
    const rows = await runner.query(
      'SELECT dashboardId,snapshot,publisherId,sourceId FROM dashboard_publication',
    );
    expect(rows).toEqual([
      { dashboardId: 51, snapshot: 'synthetic snapshot', publisherId: null, sourceId: null },
    ]);
  });
});
