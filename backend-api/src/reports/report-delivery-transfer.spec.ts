import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REPORT_ENTITIES, PrivateReport, PrivateReportRevision } from './report.entity';
import { REPORT_SHARING_ENTITIES, ReportDelivery } from './report-sharing.entity';
import { revokeReportDeliveriesForTransfer } from './report-delivery-transfer';

/**
 * Opt-in PostgreSQL run in a throwaway schema, e.g. VM_REPORT_COMMENT_POSTGRES_PORT=55491
 * (also _HOST, _USER, _PASSWORD, _DB), shared with the report comment specs.
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
const ownedReport = 'a2345678-1234-4234-8234-123456789abc';
const incomingReport = 'b2345678-1234-4234-8234-123456789abc';

describe(`report delivery revocation for staff transfer on ${
  pgPort ? 'PostgreSQL' : 'SQLite'
}`, () => {
  let admin: DataSource | undefined, schema: string | undefined, db: DataSource;
  beforeAll(async () => {
    if (pgPort) admin = await new DataSource(pgConnection()).initialize();
  });
  afterAll(async () => {
    await admin?.destroy();
  });
  const delivery = (
    reportId: string,
    ownerId: number,
    recipientId: number,
    active: boolean,
    relationVersion: number,
  ) => ({
    reportId,
    ownerId,
    recipientId,
    organizationId: 1,
    active,
    relationVersion,
    pinnedVersion: 1,
    pinnedHash: 'h'.repeat(64),
    ownerAuthVersion: 0,
    recipientAuthVersion: 0,
  });
  const rows = async () =>
    (await db.manager.find(ReportDelivery, { order: { reportId: 'ASC', recipientId: 'ASC' } })).map(
      r => [
        r.reportId === ownedReport ? 'owned' : 'incoming',
        r.recipientId,
        r.active,
        r.relationVersion,
      ],
    );

  beforeEach(async () => {
    if (admin) {
      schema = 'vm_report_transfer_' + randomUUID().replace(/-/g, '').slice(0, 16);
      await admin.query(`CREATE SCHEMA "${schema}"`);
    }
    db = await new DataSource({
      ...(admin
        ? { ...pgConnection(), schema, extra: { options: `-c search_path=${schema}` } }
        : { type: 'sqlite' as const, database: ':memory:' }),
      synchronize: true,
      entities: [...REPORT_ENTITIES, ...REPORT_SHARING_ENTITIES],
    }).initialize();
    for (const [id, ownerId] of [
      [ownedReport, 7],
      [incomingReport, 9],
    ] as const) {
      await db.manager.insert(PrivateReport, {
        id,
        ownerId,
        organizationKey: 1,
        dashboardId: 1,
        sourceId: 1,
        version: 1,
        revision: 'r'.repeat(64),
        title: 'Report',
        updatedAt: '2026-11-02T00:00:00Z',
      });
      await db.manager.insert(PrivateReportRevision, {
        reportId: id,
        version: 1,
        ownerId,
        revision: 'r'.repeat(64),
        bytes: 1,
        chunkCount: 0,
      });
    }
    await db.manager.insert(ReportDelivery, [
      delivery(ownedReport, 7, 8, true, 1),
      delivery(ownedReport, 7, 11, false, 2),
      delivery(incomingReport, 9, 7, true, 3),
      delivery(incomingReport, 9, 10, true, 4),
    ]);
  });
  afterEach(async () => {
    await db.destroy();
    if (admin && schema) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  });

  it('revokes only the moving user’s active outgoing and incoming deliveries once', async () => {
    await db.transaction(manager => revokeReportDeliveriesForTransfer(manager, 7));
    expect(await rows()).toEqual([
      ['owned', 8, false, 2],
      ['owned', 11, false, 2],
      ['incoming', 7, false, 4],
      ['incoming', 10, true, 4],
    ]);
    await db.transaction(manager => revokeReportDeliveriesForTransfer(manager, 7));
    expect((await rows())[0]).toEqual(['owned', 8, false, 2]);
  });

  it('refuses an exhausted relation version without changing any delivery', async () => {
    await db.manager.update(
      ReportDelivery,
      { reportId: incomingReport, recipientId: 7 },
      {
        relationVersion: 2147483647,
      },
    );
    const before = await rows();
    await expect(
      db.transaction(manager => revokeReportDeliveriesForTransfer(manager, 7)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await rows()).toEqual(before);
  });

  it('requires the caller’s transaction', async () => {
    await expect(revokeReportDeliveriesForTransfer(db.manager, 7)).rejects.toThrow(
      'active transaction',
    );
  });
});
