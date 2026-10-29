jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Database } from '../database/entities/database.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioService } from '../dashboard-studio/studio.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { ReportsService } from './reports.service';
import { ReportSharingService } from './report-sharing.service';
import {
  REPORT_ENTITIES,
  PrivateReport,
  PrivateReportRevision,
  PrivateReportChunk,
} from './report.entity';
import {
  REPORT_SHARING_ENTITIES,
  ReportDelivery,
  ReportDeliveryReceipt,
} from './report-sharing.entity';
import { encodeReport } from './report-contract';

const owner = { id: 7, authVersion: 0 },
  recipient = { id: 8, authVersion: 0 };
const id = 'a2345678-1234-4234-8234-123456789abc';
const payload = (reportId: string, version: number) => ({
  reportId,
  version,
  title: `Report ${version}`,
  body: `Body ${version} <script>plaintext</script>`,
  savedAt: '2026-10-29T00:00:00Z',
  snapshot: {
    capturedAt: '2026-10-28T00:00:00Z',
    rendered: {
      title: 'PRIVATE_ROOT_TITLE',
      periodLabel: '전체 기간',
      filters: ['PRIVATE_FILTER'],
      blocks: [
        {
          id: 'PRIVATE_KPI_ID',
          kind: 'BOARD_NUMERIC',
          title: '매출',
          description: '확정 매출',
          display: {
            suffix: 'USD',
            decimalPlaces: 2,
            numberNotation: 'full',
            privateOption: 'PRIVATE_OPTION',
          },
          valueField: 'PRIVATE_NET',
          fields: [{ columnName: 'PRIVATE_NET', columnType: 'number' }],
          datas: [{ PRIVATE_NET: '16537.01', SECRET: 'PRIVATE_ROW' }],
          trend: {
            grain: 'day',
            timeZone: 'UTC',
            column: 'PRIVATE_DATE',
            points: [{ time: '2026-10-28', value: '16537.01', secret: 'PRIVATE_POINT' }],
          },
        },
        {
          id: 'PRIVATE_CHART_ID',
          kind: 'CHART_COLUMN',
          title: '채널 매출',
          description: '',
          display: { suffix: 'USD' },
          valueField: 'PRIVATE_NET',
          categoryField: 'PRIVATE_CHANNEL',
          fields: [
            { columnName: 'PRIVATE_NET', columnType: 'number' },
            { columnName: 'PRIVATE_CHANNEL', columnType: 'string' },
          ],
          datas: [{ PRIVATE_NET: 500, PRIVATE_CHANNEL: 'Site', SECRET: 'PRIVATE_ROW' }],
        },
      ],
    },
    basis: {
      timeZone: 'UTC',
      dashboardId: 1,
      source: { id: 1, path: '/PRIVATE_PATH' },
      sql: 'PRIVATE_SQL',
      filters: ['PRIVATE_FILTER'],
    },
  },
});
describe('report recipient sharing with real SQLite transactions', () => {
  let db: DataSource, service: ReportSharingService, reports: ReportsService;
  async function revision(reportId = id, version = 1, dashboardId = 1) {
    const value = payload(reportId, version),
      encoded = encodeReport(value);
    const next = {
      id: reportId,
      ownerId: 7,
      organizationKey: 1,
      dashboardId,
      sourceId: 1,
      version,
      revision: encoded.hash,
      title: value.title,
      updatedAt: value.savedAt,
    };
    await db.manager.save(PrivateReport, next);
    await db.manager.insert(PrivateReportRevision, {
      reportId,
      version,
      ownerId: 7,
      revision: encoded.hash,
      bytes: encoded.bytes,
      chunkCount: encoded.chunks.length,
    });
    for (const [ordinal, chunk] of encoded.chunks.entries())
      await db.manager.insert(PrivateReportChunk, { reportId, version, ordinal, payload: chunk });
    return next;
  }
  const share = async (recipientId = 8, expectedRelationVersion = 0) => ({
    requestId: randomUUID(),
    expectedOrganizationId: 1,
    recipientId,
    expectedRelationVersion,
    operation: {
      kind: 'share',
      expectedHeadRevision: (await db.manager.findOneByOrFail(PrivateReport, { id })).revision,
    },
  });
  const revoke = (expectedRelationVersion = 1, recipientId = 8) => ({
    requestId: randomUUID(),
    expectedOrganizationId: 1,
    recipientId,
    expectedRelationVersion,
    operation: { kind: 'revoke' },
  });
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        User,
        EnterpriseMembership,
        Dashboard,
        Database,
        UserMapping,
        StudioState,
        ...REPORT_ENTITIES,
        ...REPORT_SHARING_ENTITIES,
      ],
    }).initialize();
    for (const uid of [7, 8, 9, 10]) {
      await db.manager.insert(User, {
        id: uid,
        userId: `user-${uid}`,
        email: `synthetic-${uid}@example.invalid`,
        password: 'synthetic',
        active: uid !== 10,
      });
      await db.manager.insert(EnterpriseMembership, {
        userId: uid,
        organizationId: uid === 9 ? 2 : 1,
        role: 'member',
        team: 'Team',
      });
    }
    await db.manager.insert(Database, {
      id: 1,
      ownerId: 7,
      name: 'PRIVATE_SOURCE',
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.manager.insert(Dashboard, {
      id: 1,
      title: 'PRIVATE_DASHBOARD',
      analysisDefinition: JSON.stringify({ databaseId: 1 }),
    });
    await db.manager.insert(UserMapping, { dashboardId: 1, userInfoId: 7 });
    await db.manager.insert(StudioState, {
      dashboardId: 1,
      document: JSON.stringify({ document: { sourceId: 1 } }),
      legacyRevision: 'x',
    });
    await revision();
    const access = new SourceAccessService(db);
    reports = new ReportsService(db, new StudioService(db, null, null, access), access);
    service = new ReportSharingService(db, reports);
  });
  afterEach(async () => {
    await db.destroy();
  });
  it('rejects an omitted JWT epoch on every entrypoint instead of adopting the database epoch', async () => {
    const legacy = { id: 7, authVersion: undefined };
    await expect(service.reader(id, legacy)).rejects.toThrow();
    await expect(service.library(legacy)).rejects.toThrow();
    await expect(service.peers(id, legacy, {})).rejects.toThrow();
    await expect(service.shares(id, legacy)).rejects.toThrow();
    await expect(service.change(id, await share(), legacy)).rejects.toThrow();
    await expect(service.outcome(id, randomUUID(), legacy)).rejects.toThrow();
    expect(await db.manager.count(ReportDeliveryReceipt)).toBe(0);
  });
  it('compares the original numeric request epoch after lock acquisition', async () => {
    const command = await share();
    const find = EntityManager.prototype.findOne;
    let advanced = false;
    const spy = jest
      .spyOn(EntityManager.prototype, 'findOne')
      .mockImplementation(async function (target, options) {
        if (target === User && !advanced) {
          advanced = true;
          await this.update(User, 7, { authVersion: 1 });
        }
        return find.call(this, target, options);
      });
    try {
      await expect(service.change(id, command, owner)).rejects.toThrow('로그인');
    } finally {
      spy.mockRestore();
    }
    expect(advanced).toBe(true);
    expect(await db.manager.count(ReportDeliveryReceipt)).toBe(0);
  });
  it('returns only the pinned safe result, retains labels/units/trend, and leaves root tables unchanged', async () => {
    const before = await Promise.all([
      db.manager.find(Dashboard),
      db.manager.find(Database),
      db.manager.find(UserMapping),
      db.manager.find(StudioState),
    ]);
    await expect(service.reader(id, recipient)).rejects.toThrow();
    await service.change(id, await share(), owner);
    const read = await service.reader(id, recipient);
    expect(read).toMatchObject({ role: 'recipient', title: 'Report 1', version: 1 });
    expect(read.blocks[0]).toMatchObject({
      title: '매출',
      display: { suffix: 'USD', decimalPlaces: 2 },
      value: '16537.01',
      trend: { points: [{ time: '2026-10-28', value: '16537.01' }] },
    });
    expect(JSON.stringify(read)).not.toMatch(
      /PRIVATE_|revision|valueField|categoryField|columnName|schema|sourceId|dashboardId|reportId/,
    );
    expect(
      await Promise.all([
        db.manager.find(Dashboard),
        db.manager.find(Database),
        db.manager.find(UserMapping),
        db.manager.find(StudioState),
      ]),
    ).toEqual(before);
    await expect(reports.get(id, recipient)).rejects.toThrow('본인의');
    expect((await service.library(recipient)).items).toEqual([
      {
        kind: 'report',
        id,
        title: 'Report 1',
        version: 1,
        updatedAt: '2026-10-29T00:00:00Z',
        ownership: 'received',
      },
    ]);
  });
  it('holds the pin through owner edits, rejects stale new sharing, and replays history without reviving revoke', async () => {
    const command = await share();
    await service.change(id, command, owner);
    await revision(id, 2);
    expect((await service.reader(id, recipient)).version).toBe(1);
    expect((await service.reader(id, owner)).version).toBe(2);
    await expect(
      service.change(
        id,
        { ...command, requestId: randomUUID(), expectedRelationVersion: 1 },
        owner,
      ),
    ).rejects.toThrow('저장본');
    await service.change(id, revoke(), owner);
    const historical = await service.change(id, command, owner);
    expect(historical).toMatchObject({
      replayed: true,
      receipt: { operation: 'share', relationVersion: 1 },
    });
    await expect(service.reader(id, recipient)).rejects.toThrow();
    expect((await service.library(recipient)).items).toEqual([]);
    expect(await service.outcome(id, command.requestId, owner)).toMatchObject({
      status: 'committed',
    });
    await service.change(id, await share(8, 2), owner);
    expect((await service.reader(id, recipient)).version).toBe(2);
  });
  it('checks current epoch/org before historical receipt and requires explicit same-version reshare after epoch changes', async () => {
    const command = await share();
    await service.change(id, command, owner);
    await db.manager.update(User, 8, { authVersion: 1 });
    await expect(service.reader(id, { ...recipient, authVersion: 1 })).rejects.toThrow();
    expect((await service.shares(id, owner)).items[0].status).toBe('suspended');
    await service.change(id, await share(8, 1), owner);
    expect((await service.shares(id, owner)).items[0].relationVersion).toBe(2);
    expect((await service.reader(id, { ...recipient, authVersion: 1 })).version).toBe(1);
    await db.manager.update(User, 7, { authVersion: 1 });
    await expect(service.change(id, command, owner)).rejects.toThrow('로그인');
    await expect(service.outcome(id, command.requestId, owner)).rejects.toThrow('로그인');
    await expect(service.reader(id, { ...recipient, authVersion: 1 })).rejects.toThrow();
    await service.change(id, await share(8, 2), { ...owner, authVersion: 1 });
    expect((await service.shares(id, { ...owner, authVersion: 1 })).items[0].relationVersion).toBe(
      3,
    );
    await db.manager.update(EnterpriseMembership, 7, { organizationId: 2 });
    await expect(service.change(id, command, { ...owner, authVersion: 1 })).rejects.toThrow();
  });
  it('permits ordinary owners to search only active same-org peers, escaping wildcards and omitting email', async () => {
    expect(await service.peers(id, owner, { q: 'user' })).toEqual({
      items: [{ id: 8, userId: 'user-8', team: 'Team' }],
      nextCursor: null,
    });
    expect((await service.peers(id, owner, { q: '%' })).items).toEqual([]);
    await expect(service.peers(id, recipient, { q: '' })).rejects.toThrow();
    for (const recipientId of [7, 9, 10])
      await expect(service.change(id, await share(recipientId), owner)).rejects.toThrow();
    await expect(
      service.change(id, { ...(await share()), unknown: true }, owner),
    ).rejects.toThrow();
    expect(await db.manager.count(ReportDelivery)).toBe(0);
  });
  it('revokes stale/inactive recipients under inactive roots without returning report content', async () => {
    await service.change(id, await share(), owner);
    await db.manager.update(Dashboard, 1, { assetActive: false });
    await db.manager.update(Database, 1, { catalogActive: false });
    await db.manager.update(User, 8, { active: false });
    await expect(service.reader(id, owner)).rejects.toThrow();
    const management = await service.shares(id, owner);
    expect(management).toMatchObject({
      canShare: false,
      headRevision: null,
      headVersion: null,
      items: [{ status: 'suspended', userId: null }],
    });
    expect(JSON.stringify(management)).not.toContain('Report 1');
    await service.change(id, revoke(), owner);
    expect((await service.shares(id, owner)).items[0].status).toBe('revoked');
    expect((await service.library(owner)).items).toEqual([]);
  });
  it('omits inaccessible reports without failing a mixed page and advances over hidden candidates', async () => {
    const inaccessible = 'b2345678-1234-4234-8234-123456789abc';
    await revision(inaccessible, 1, 404);
    const missingSource = 'c2345678-1234-4234-8234-123456789abc';
    await revision(missingSource);
    await db.manager.update(PrivateReport, missingSource, { sourceId: 404 });
    const inactive = 'd2345678-1234-4234-8234-123456789abc';
    await db.manager.insert(Dashboard, {
      id: 2,
      title: 'hidden',
      assetActive: false,
      analysisDefinition: JSON.stringify({ databaseId: 1 }),
    });
    await revision(inactive, 1, 2);
    expect((await service.library(owner)).items.map(row => row.id)).toEqual([id]);
    for (let i = 0; i < 48; i += 1)
      await db.manager.insert(PrivateReport, {
        id: `e2345678-1234-4234-8234-${String(i).padStart(12, '0')}`,
        ownerId: 7,
        organizationKey: 1,
        dashboardId: 404,
        sourceId: 1,
        version: 1,
        revision: 'a'.repeat(64),
        title: 'hidden',
        updatedAt: 'now',
      });
    const page = await service.library(owner);
    expect(page.items.map(row => row.id)).toEqual([id]);
    expect(page.nextCursor).not.toBeNull();
    expect((await service.library(owner, page.nextCursor)).items).toEqual([]);
  });
  it('rejects changed UUID input and stale CAS without writes', async () => {
    const command = await share();
    await service.change(id, command, owner);
    await expect(service.change(id, { ...command, recipientId: 9 }, owner)).rejects.toThrow('입력');
    await expect(service.change(id, revoke(0), owner)).rejects.toThrow('공유 상태');
    expect(await db.manager.count(ReportDeliveryReceipt)).toBe(1);
    expect(
      (await db.manager.findOneBy(ReportDelivery, { reportId: id, recipientId: 8 })).active,
    ).toBe(true);
  });
  it('serializes a conservative total limit including suspended relations across separate requests', async () => {
    const head = await db.manager.findOneByOrFail(PrivateReport, { id });
    for (let i = 11; i < 62; i += 1) {
      await db.manager.insert(User, {
        id: i,
        userId: `extra-${i}`,
        email: `extra-${i}@example.invalid`,
        password: 'synthetic',
      });
      await db.manager.insert(EnterpriseMembership, {
        userId: i,
        organizationId: 1,
        role: 'member',
      });
      if (i < 60)
        await db.manager.insert(ReportDelivery, {
          reportId: id,
          recipientId: i,
          ownerId: 7,
          organizationId: 1,
          active: true,
          relationVersion: 1,
          pinnedVersion: 1,
          pinnedHash: head.revision,
          ownerAuthVersion: 0,
          recipientAuthVersion: 999,
        });
    }
    const results = await Promise.allSettled([
      service.change(id, await share(60), owner),
      service.change(id, await share(61), owner),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.manager.countBy(ReportDelivery, { reportId: id, active: true })).toBe(50);
    await service.change(id, revoke(1, 11), owner);
    await service.change(id, await share(), owner);
    expect(await db.manager.countBy(ReportDelivery, { reportId: id, active: true })).toBe(50);
  });
  it('rolls back a relation when receipt insertion fails, then commits the exact retry once', async () => {
    const command = await share();
    const insert = EntityManager.prototype.insert;
    const spy = jest
      .spyOn(EntityManager.prototype, 'insert')
      .mockImplementation(function (target, value) {
        if (target === ReportDeliveryReceipt) throw new Error('receipt failure');
        return insert.call(this, target, value);
      });
    try {
      await expect(service.change(id, command, owner)).rejects.toThrow('receipt failure');
    } finally {
      spy.mockRestore();
    }
    expect(await db.manager.count(ReportDelivery)).toBe(0);
    await service.change(id, command, owner);
    expect((await service.change(id, command, owner)).replayed).toBe(true);
    expect(await db.manager.count(ReportDeliveryReceipt)).toBe(1);
  });
  it.each(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'])(
    'maps %s to a retryable conflict without receipts',
    async code => {
      const command = await share();
      const spy = jest
        .spyOn(EntityManager.prototype, 'findOne')
        .mockRejectedValueOnce(
          new QueryFailedError('synthetic', [], Object.assign(new Error('contention'), { code })),
        );
      try {
        await expect(service.change(id, command, owner)).rejects.toMatchObject({ status: 409 });
      } finally {
        spy.mockRestore();
      }
      expect(await db.manager.count(ReportDeliveryReceipt)).toBe(0);
      expect((await service.change(id, command, owner)).receipt.relationVersion).toBe(1);
    },
  );
});
