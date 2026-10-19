import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import request = require('supertest');
import { DataSource, EntityManager } from 'typeorm';
import { semanticMetadata } from '../../test/util/semantic-mysql';
import { HttpExceptionFilter } from '../nest-utils/http-exception.filter';
import { HandoverProposalService } from './handover-proposal.service';
import { HandoverTransferService } from './handover-transfer.service';
import { HandoverTransferController } from './handover-transfer.controller';
import { EnterpriseHandoverProposal } from './entities/enterprise-handover-proposal.entity';
import { EnterpriseHandoverTransfer } from './entities/enterprise-handover-transfer.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from './entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Component } from '../component/entities/component.entity';
import { Database } from '../database/entities/database.entity';
import { Metric, MetricAggregation } from '../metric/entities/metric.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioExecution } from '../dashboard-studio/entities/studio-execution.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { BiDashboardPolicy } from '../bi/governance.entity';
import { DashboardService } from '../dashboard/dashboard.service';
import { DashboardWidgetService } from '../dashboard/dashboard-widget/dashboard-widget.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { sourceQuery, widgetOptions } from '../ai/dashboard-draft';
import { renderValidatedQueryBindings } from '../common/validated-query-bindings';
import { AddHandoverTransfer1792610000000 } from '../migrations/1792610000000-add-handover-transfer';

const entities = [
  User,
  EnterpriseOrganization,
  EnterpriseMembership,
  Database,
  Metric,
  Dashboard,
  UserMapping,
  StudioState,
  DashboardWidget,
  Widget,
  Dataset,
  TableQuery,
  Component,
  DashboardShare,
  DashboardPublication,
  StudioExecution,
  StudioPublication,
  BiDashboardPolicy,
  EnterpriseResourceGrant,
  EnterpriseGroupGrant,
  EnterpriseDashboardDelivery,
  EnterpriseGroupDelivery,
  EnterpriseAuditEvent,
  EnterpriseHandoverProposal,
  EnterpriseHandoverTransfer,
];
describe('UC051 final dashboard transfer actual HTTP and metadata', () => {
  jest.setTimeout(30000);
  let db: DataSource,
    app: INestApplication,
    intent: HandoverProposalService,
    service: HandoverTransferService;
  const jwt = new JwtService(),
    oldSecret = process.env.ACCESS_SECRET;
  const token = (actor = 1, epoch = 0) =>
    jwt.sign(
      { accessKeyData: { id: actor, userId: `transfer-${actor}`, authVersion: epoch } },
      { secret: process.env.ACCESS_SECRET },
    );
  const http = (method: 'get' | 'post', path: string, actor = 1, body?: any, epoch = 0) => {
    const req = request(app.getHttpServer())
      [method]('/enterprise/handover/' + path)
      .set('Authorization', 'Bearer ' + token(actor, epoch));
    return body === undefined ? req : req.send(body);
  };
  const terms = (row: any) => ({
    expectedVersion: row.version,
    reviewBasis: row.reviewBasis,
    acknowledgedTransfer: true,
  });
  const snapshot = async () =>
    Promise.all(
      entities.map(e =>
        db.getRepository(e).find({
          order: Object.fromEntries(
            db.getMetadata(e).primaryColumns.map(c => [c.propertyName, 'ASC']),
          ),
        }),
      ),
    );
  const newIntent = async (
    assets = [{ kind: 'dashboard', id: 21, title: 'Synthetic dashboard' }],
  ) => {
    const proposal = await intent.create(1, 0, { requestId: randomUUID(), recipientId: 2, assets });
    return intent.accept(proposal.requestId, 2, 0, {
      expectedVersion: proposal.version,
      reviewBasis: proposal.reviewBasis,
    });
  };
  const prepare = async (proposal?: any) => {
    proposal ??= await newIntent();
    const review = (await http('get', proposal.requestId + '/transfer-review').expect(200)).body;
    expect(review).toMatchObject({ eligible: true, blockers: [] });
    const body = {
      requestId: randomUUID(),
      expectedProposalVersion: proposal.version,
      basis: review.basis,
      acknowledgedTransfer: true,
    };
    return {
      proposal,
      body,
      row: (await http('post', proposal.requestId + '/transfer', 1, body).expect(201)).body,
    };
  };
  const canonical = async () => {
    const definition = {
      blockId: 'block-00000000-0000-4000-8000-000000000021',
      title: 'Total',
      description: 'Synthetic',
      type: 'BOARD_NUMERIC' as const,
      sql: 'SELECT sum(amount) AS value FROM source',
      valueField: 'value',
      decimalPlaces: 0,
    };
    const draft = {
      databaseId: 11,
      title: 'Synthetic dashboard',
      explanation: '',
      widgets: [definition],
    };
    const query = sourceQuery(definition.sql, []);
    await db.manager.insert(Component, {
      id: 51,
      type: definition.type,
      title: 'Number',
      option: '{}',
    });
    await db.manager.insert(Dataset, {
      id: 61,
      databaseId: 11,
      title: definition.title,
      query: renderValidatedQueryBindings(query.sql, query.bindings),
    });
    await db.manager.insert(Widget, {
      id: 71,
      title: definition.title,
      description: definition.description,
      componentId: 51,
      datasetType: DatasetType.DATASET,
      datasetId: 61,
      option: JSON.stringify(widgetOptions(definition)),
    });
    await db.manager.insert(DashboardWidget, { id: 81, dashboardId: 21, widgetId: 71 });
    await db.manager.update(Dashboard, 21, {
      analysisDefinition: JSON.stringify(draft),
      layout: JSON.stringify([{ i: '71', x: 0, y: 0, w: 6, h: 2 }]),
    });
    const row = await db.manager.findOneBy(Dashboard, { id: 21 });
    const document = {
      schemaVersion: 1,
      dashboardId: 21,
      revision: dashboardRevision(row),
      title: row.title,
      sourceId: 11,
      blocks: [
        {
          id: definition.blockId,
          definitionKey: definition.blockId,
          kind: definition.type,
          title: definition.title,
          description: definition.description,
          measureRefs: [],
          dimensionRefs: [],
          display: { decimalPlaces: 0 },
        },
      ],
      layouts: {
        lg: [{ id: definition.blockId, x: 0, y: 0, w: 6, h: 2 }],
        md: [{ id: definition.blockId, x: 0, y: 0, w: 8, h: 2 }],
        xs: [{ id: definition.blockId, x: 0, y: 0, w: 1, h: 2 }],
      },
    };
    await db.manager.insert(StudioState, {
      dashboardId: 21,
      legacyRevision: dashboardRevision(row),
      document: JSON.stringify({ document, sourceRevision: 'a'.repeat(64) }),
    });
  };
  const dashboardService = () =>
    new DashboardService(
      db.getRepository(Dashboard),
      db.getRepository(User),
      db.getRepository(DashboardShare),
      db.getRepository(UserMapping),
      new DashboardWidgetService(
        db.getRepository(DashboardWidget),
        db.getRepository(Widget),
        db.getRepository(Component),
      ),
      undefined,
      undefined,
      db.getRepository(Widget),
      new SourceAccessService(db),
    );
  beforeAll(async () => {
    process.env.ACCESS_SECRET = 'synthetic-transfer-secret';
    db = await semanticMetadata('handover', {
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    });
    intent = new HandoverProposalService(db);
    service = new HandoverTransferService(db, intent);
    const module = await Test.createTestingModule({
      controllers: [HandoverTransferController],
      providers: [
        { provide: HandoverTransferService, useValue: service },
        { provide: JwtService, useValue: jwt },
        { provide: DataSource, useValue: db },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0, '127.0.0.1');
  });
  afterAll(async () => {
    await app?.close();
    await db?.destroy();
    if (oldSecret === undefined) delete process.env.ACCESS_SECRET;
    else process.env.ACCESS_SECRET = oldSecret;
  });
  afterEach(() => jest.restoreAllMocks());
  beforeEach(async () => {
    jest.restoreAllMocks();
    for (const entity of [...entities].reverse())
      await db.getRepository(entity).createQueryBuilder().delete().execute();
    await db.manager.insert(
      User,
      [1, 2, 3, 4].map(id => ({
        id,
        userId: `transfer-${id}`,
        email: `transfer-${id}@example.invalid`,
        password: 'synthetic',
        active: true,
        authVersion: 0,
      })),
    );
    await db.manager.insert(EnterpriseOrganization, [
      { id: 10, name: 'Synthetic', version: 1 },
      { id: 20, name: 'Other', version: 1 },
    ]);
    await db.manager.insert(
      EnterpriseMembership,
      [1, 2, 3, 4].map(userId => ({
        userId,
        organizationId: userId === 4 ? 20 : 10,
        role: 'member' as const,
        team: '',
      })),
    );
    await db.manager.insert(Database, {
      id: 11,
      name: 'Synthetic source',
      ownerId: 2,
      catalogActive: true,
      engine: 'duckdb',
      type: 'FILE',
      connectionConfig: '{}',
    });
    await db.manager.insert(Dashboard, [
      { id: 21, title: 'Synthetic dashboard', layout: '[]' },
      { id: 22, title: 'Second dashboard', layout: '[]' },
    ]);
    await db.manager.insert(UserMapping, [
      { id: 41, dashboardId: 21, userInfoId: 1 },
      { id: 42, dashboardId: 22, userInfoId: 1 },
    ]);
  });
  it('requires actual JWT and strict body; missing intent/final404, unrelated403, invalid UUID400', async () => {
    await request(app.getHttpServer())
      .get('/enterprise/handover/' + randomUUID() + '/transfer')
      .expect(401);
    await http('get', 'invalid/transfer').expect(400);
    await http('get', randomUUID() + '/transfer').expect(404);
    const p = await newIntent();
    await http('get', p.requestId + '/transfer').expect(404);
    await http('get', p.requestId + '/transfer-review', 2).expect(403);
    await http('get', p.requestId + '/transfer', 3).expect(403);
    await http('post', p.requestId + '/transfer', 1, {}).expect(400);
    const prepared = await prepare(p);
    for (const body of [
      { ...terms(prepared.row), acknowledgedTransfer: false },
      { ...terms(prepared.row), extra: 1 },
    ])
      await http('post', p.requestId + '/transfer/accept', 2, body).expect(400);
  });
  it('separates final consents and atomically preserves mapping IDs, Studio bytes and unrelated rows', async () => {
    await canonical();
    const p = await newIntent([
      { kind: 'dashboard', id: 21, title: 'Synthetic dashboard' },
      { kind: 'dashboard', id: 22, title: 'Second dashboard' },
    ]);
    const beforeRead = await snapshot();
    const review = (await http('get', p.requestId + '/transfer-review').expect(200)).body;
    expect(Object.keys(review).sort()).toEqual(
      [
        'proposalId',
        'organizationId',
        'ownerId',
        'recipientId',
        'proposalVersion',
        'checkedAt',
        'basis',
        'eligible',
        'blockers',
        'dashboards',
      ].sort(),
    );
    expect(review).toMatchObject({ eligible: true, blockers: [] });
    expect(await snapshot()).toEqual(beforeRead);
    const { body, row } = await prepare(p);
    expect(Object.keys(row).sort()).toEqual(
      [
        'proposalId',
        'requestId',
        'organizationId',
        'ownerId',
        'recipientId',
        'version',
        'status',
        'reviewBasis',
        'expiresAt',
        'acceptedAt',
        'completedAt',
        'detailsAvailable',
        'dashboards',
        'replayed',
      ].sort(),
    );
    expect(row).toMatchObject({
      status: 'prepared',
      version: 1,
      detailsAvailable: true,
      replayed: false,
    });
    await http('post', p.requestId + '/transfer/execute', 1, terms(row)).expect(409);
    await http('post', p.requestId + '/transfer/accept', 1, terms(row)).expect(403);
    const accepted = (
      await http('post', p.requestId + '/transfer/accept', 2, terms(row)).expect(201)
    ).body;
    expect(accepted).toMatchObject({ status: 'accepted', version: 2 });
    const resources = await snapshot();
    const completed = (
      await http('post', p.requestId + '/transfer/execute', 1, terms(accepted)).expect(201)
    ).body;
    expect(completed).toMatchObject({
      status: 'completed',
      version: 3,
      completedAt: expect.any(String),
    });
    expect(await db.manager.find(UserMapping, { order: { id: 'ASC' } })).toMatchObject([
      { id: 41, userInfoId: 2 },
      { id: 42, userInfoId: 2 },
    ]);
    const studio = await db.manager.findOneBy(StudioState, { dashboardId: 21 });
    expect(studio.document).toBe(
      (resources[entities.indexOf(StudioState)][0] as unknown as StudioState).document,
    );
    expect(studio.legacyRevision).toBe(
      dashboardRevision(await db.manager.findOneBy(Dashboard, { id: 21 })),
    );
    for (const entity of [Database, Metric, Widget, Dataset, DashboardWidget, Component])
      expect((await snapshot())[entities.indexOf(entity)]).toEqual(
        resources[entities.indexOf(entity)],
      );
    const access = new SourceAccessService(db);
    await expect(access.dashboard(21, 1, 'owner')).rejects.toMatchObject({ status: 403 });
    await access.dashboard(21, 2, 'owner');
    await expect(
      dashboardService().update(21, { title: 'Late old-owner write' } as any, 1),
    ).rejects.toMatchObject({ status: 403 });
    const stable = await snapshot();
    expect(
      (await http('post', p.requestId + '/transfer/execute', 1, terms(accepted)).expect(201)).body,
    ).toEqual({ ...completed, replayed: true });
    expect((await http('post', p.requestId + '/transfer', 1, body).expect(201)).body).toEqual({
      ...completed,
      replayed: true,
    });
    await http('get', p.requestId + '/transfer', 2).expect(200);
    expect(await snapshot()).toEqual(stable);
    const stored = await db.manager.findOneBy(EnterpriseHandoverTransfer, {
      proposalId: p.requestId,
    });
    const events = await db.manager.find(EnterpriseAuditEvent, { order: { id: 'ASC' } });
    for (const id of [stored.preparedAuditId, stored.acceptedAuditId, stored.completedAuditId])
      expect(events.filter(e => e.id === id)).toHaveLength(1);
    expect(
      new Set([stored.preparedAuditId, stored.acceptedAuditId, stored.completedAuditId]).size,
    ).toBe(3);
  });
  it('supports explicit Studio unlinked snapshot without treating it as a missing metric', async () => {
    await canonical();
    await db.manager.update(Dashboard, 21, {
      structuredDefinition: JSON.stringify({
        schemaVersion: 2,
        kind: 'structured-bi-dashboard',
        sourceId: 11,
        items: [{ kind: 'studio-unlinked-legacy', sourceId: 11 }],
      }),
    });
    await db.manager.update(StudioState, 21, {
      legacyRevision: dashboardRevision(await db.manager.findOneBy(Dashboard, { id: 21 })),
    });
    await prepare();
  });
  it.each(['succeeded', 'unsupported', 'cancelled'])(
    'allows terminal StudioExecution %s without changing journal',
    async status => {
      await db.manager.insert(StudioExecution, {
        runId: randomUUID(),
        actorId: 1,
        dashboardId: 21,
        requestId: randomUUID(),
        payloadHash: 'a'.repeat(64),
        status,
        state: '{}',
      });
      await prepare();
    },
  );
  it.each(['partial', 'interrupted', 'failed', 'running', 'completed'])(
    'blocks unresolved StudioExecution %s',
    async status => {
      await db.manager.insert(StudioExecution, {
        runId: randomUUID(),
        actorId: 1,
        dashboardId: 21,
        requestId: randomUUID(),
        payloadHash: 'a'.repeat(64),
        status,
        state: '{}',
      });
      const p = await newIntent();
      const before = await snapshot();
      expect(
        (await http('get', p.requestId + '/transfer-review').expect(200)).body.blockers,
      ).toContain('running_work');
      expect(await snapshot()).toEqual(before);
    },
  );
  it.each([
    'activeGrant',
    'groupGrant',
    'delivery',
    'groupDelivery',
    'copyOnly',
    'missingShare',
    'shareReuse',
    'sharedShare',
    'publication',
    'studioPublication',
    'policy',
    'governed',
    'template',
    'versionLimit',
    'duplicateMapping',
    'sharedWidget',
    'sharedDataset',
    'extraWidget',
    'badDatasetQuery',
    'badOptions',
    'pivot',
    'staleStudio',
    'sourceOwner',
  ])('rejects unsafe current %s without writes', async kind => {
    if (
      [
        'sharedWidget',
        'sharedDataset',
        'extraWidget',
        'badDatasetQuery',
        'badOptions',
        'staleStudio',
        'sourceOwner',
      ].includes(kind)
    )
      await canonical();
    const grant = {
      resourceKind: 'dashboard' as const,
      resourceId: 21,
      organizationId: 10,
      ownerId: 1,
      version: 1,
      read: true,
    };
    if (kind === 'activeGrant')
      await db.manager.insert(EnterpriseResourceGrant, { ...grant, recipientId: 3 });
    if (kind === 'groupGrant')
      await db.manager.insert(EnterpriseGroupGrant, { ...grant, groupId: 9 });
    if (['delivery', 'copyOnly'].includes(kind))
      await db.manager.insert(EnterpriseDashboardDelivery, {
        ownerId: 1,
        organizationId: 10,
        dashboardId: 21,
        recipientId: 3,
        version: 1,
        active: kind === 'delivery',
        allowCopy: kind === 'copyOnly',
      });
    if (kind === 'groupDelivery')
      await db.manager.insert(EnterpriseGroupDelivery, {
        ownerId: 1,
        organizationId: 10,
        dashboardId: 21,
        groupId: 9,
        version: 1,
        active: true,
      });
    if (kind === 'missingShare') await db.manager.update(Dashboard, 21, { shareId: 999 });
    if (['shareReuse', 'sharedShare'].includes(kind)) {
      await db.manager.insert(DashboardShare, {
        id: 31,
        uuid: randomUUID(),
        allowReuse: kind === 'shareReuse',
      });
      await db.manager.update(Dashboard, 21, { shareId: 31 });
      if (kind === 'sharedShare') await db.manager.update(Dashboard, 22, { shareId: 31 });
    }
    if (kind === 'publication')
      await db.manager.insert(DashboardPublication, {
        dashboardId: 21,
        uuid: randomUUID(),
        version: 1,
        dashboardRevision: 'a'.repeat(64),
        snapshot: '{}',
        publishedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        active: true,
        requestId: randomUUID(),
        payloadDigest: 'a'.repeat(64),
      });
    if (kind === 'studioPublication')
      await db.manager.insert(StudioPublication, {
        token: 'a'.repeat(64),
        actorId: 1,
        dashboardId: 21,
        sourceId: 11,
        version: 1,
        visibility: 'private',
        allowRemix: false,
        asOf: new Date().toISOString(),
        dataVersion: 'a'.repeat(64),
        snapshot: '{}',
      });
    if (kind === 'policy')
      await db.manager.insert(BiDashboardPolicy, {
        organizationId: 10,
        dashboardId: 21,
        groupId: 9,
        displayTitle: 'private',
        dashboardRevision: 'a'.repeat(64),
        sourceRevision: 'a'.repeat(64),
        recipe: '{}',
      });
    if (kind === 'governed') await db.manager.update(Dashboard, 21, { governed: true });
    if (kind === 'template') await db.manager.update(Dashboard, 21, { templateId: 1 });
    if (kind === 'versionLimit')
      await db.manager.update(Dashboard, 21, { assetVersion: 2147483647 });
    if (kind === 'sharedWidget')
      await db.manager.insert(DashboardWidget, { dashboardId: 22, widgetId: 71 });
    if (kind === 'sharedDataset')
      await db.manager.insert(Widget, {
        title: 'Other',
        componentId: 51,
        datasetType: DatasetType.DATASET,
        datasetId: 61,
        option: '{}',
        delYn: 'Y',
      });
    if (kind === 'extraWidget')
      await db.manager.insert(DashboardWidget, { dashboardId: 21, widgetId: 999 });
    if (kind === 'badDatasetQuery')
      await db.manager.update(Dataset, 61, { query: 'SELECT private FROM uploaded_data' });
    if (kind === 'badOptions') await db.manager.update(Widget, 71, { option: '{}' });
    if (kind === 'pivot')
      await db.manager.update(Dashboard, 21, { pivotDefinitions: '[{"sourceId":11}]' });
    if (kind === 'staleStudio')
      await db.manager.update(StudioState, 21, { legacyRevision: 'b'.repeat(64) });
    if (kind === 'sourceOwner') await db.manager.update(Database, 11, { ownerId: 1 });
    const p = await newIntent();
    if (kind === 'duplicateMapping')
      await db.manager.insert(UserMapping, { dashboardId: 21, userInfoId: 1 });
    const before = await snapshot();
    const r = await http('get', p.requestId + '/transfer-review');
    if (kind === 'duplicateMapping') expect(r.status).toBe(409);
    else {
      expect(r.status).toBe(200);
      expect(r.body.eligible).toBe(false);
      expect(r.body.blockers.length).toBeGreaterThan(0);
    }
    expect(await snapshot()).toEqual(before);
  });
  it('blocks selected source rather than partially transferring dashboards', async () => {
    await db.manager.update(Database, 11, { ownerId: 1 });
    const p = await newIntent([
      { kind: 'dashboard', id: 21, title: 'Synthetic dashboard' },
      { kind: 'source', id: 11, title: 'Synthetic source' },
    ]);
    expect((await http('get', p.requestId + '/transfer-review').expect(200)).body).toMatchObject({
      eligible: false,
      blockers: ['source_transfer_deferred'],
    });
  });
  it('binds metadata children to final basis and rejects changed recipient-owned source', async () => {
    await canonical();
    const { proposal: p, row } = await prepare();
    await db.manager.update(Dataset, 61, { title: 'Changed' });
    const before = await snapshot();
    await http('post', p.requestId + '/transfer/accept', 2, terms(row)).expect(409);
    expect(await snapshot()).toEqual(before);
  });
  it('rolls back the full mapping batch and audit links when the second mapping update fails', async () => {
    const p = await newIntent([
      { kind: 'dashboard', id: 21, title: 'Synthetic dashboard' },
      { kind: 'dashboard', id: 22, title: 'Second dashboard' },
    ]);
    const { row } = await prepare(p);
    const accepted = (
      await http('post', p.requestId + '/transfer/accept', 2, terms(row)).expect(201)
    ).body;
    const before = await snapshot();
    const original = EntityManager.prototype.update;
    jest
      .spyOn(EntityManager.prototype, 'update')
      .mockImplementation(function (entity: any, criteria: any, update: any) {
        if (entity === UserMapping && criteria.dashboardId === 22)
          throw new Error('Synthetic second mapping failure');
        return original.call(this, entity, criteria, update);
      });
    await expect(service.change(p.requestId, 1, 0, terms(accepted), 'execute')).rejects.toThrow(
      'Synthetic second mapping failure',
    );
    expect(await snapshot()).toEqual(before);
  });
  it('rolls back after all mappings when exact completion audit insert fails', async () => {
    const { proposal: p, row } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    const before = await snapshot();
    const original = EntityManager.prototype.insert;
    jest
      .spyOn(EntityManager.prototype, 'insert')
      .mockImplementation(function (entity: any, body: any) {
        if (entity === EnterpriseAuditEvent && body.action === 'handover.transfer.completed')
          throw new Error('Synthetic audit failure');
        return original.call(this, entity, body);
      });
    await expect(service.change(p.requestId, 1, 0, terms(accepted), 'execute')).rejects.toThrow(
      'Synthetic audit failure',
    );
    expect(await snapshot()).toEqual(before);
  });
  it('historical retries write zero after completion, metadata change, intent cancel and expiry', async () => {
    const { proposal: p, row, body } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    await service.change(p.requestId, 1, 0, terms(accepted), 'execute');
    await db.manager.update(Dashboard, 21, { title: 'New owner title' });
    await db.manager.update(EnterpriseHandoverProposal, p.requestId, {
      status: 'cancelled',
      expiresAt: new Date(0),
    });
    const before = await snapshot();
    for (const result of [
      await service.prepare(p.requestId, 1, 0, body),
      await service.change(p.requestId, 2, 0, terms(row), 'accept'),
      await service.change(p.requestId, 1, 0, terms(accepted), 'execute'),
      await service.detail(p.requestId, 2, 0),
    ])
      expect(result).toMatchObject({
        status: 'completed',
        detailsAvailable: false,
        dashboards: [],
      });
    expect(await snapshot()).toEqual(before);
  });
  it('cancel remains possible after expiry/epoch change; accept replay never reactivates it', async () => {
    const { proposal: p, row } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    await db.manager.update(User, 2, { authVersion: 1 });
    await db.manager.update(EnterpriseHandoverTransfer, p.requestId, { expiresAt: new Date(0) });
    const cancelled = await service.change(p.requestId, 1, 0, terms(accepted), 'cancel');
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      detailsAvailable: false,
      dashboards: [],
    });
    const before = await snapshot();
    expect(await service.change(p.requestId, 2, 1, terms(row), 'accept')).toMatchObject({
      status: 'cancelled',
      replayed: true,
    });
    expect(await snapshot()).toEqual(before);
  });
  it.each([
    'actorEpoch',
    'recipientEpoch',
    'recipientMove',
    'organizationVersion',
    'intentCancel',
    'title',
  ])('rejects current %s before execution and preserves all rows', async kind => {
    const { proposal: p, row } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    if (kind === 'actorEpoch') await db.manager.update(User, 1, { authVersion: 1 });
    if (kind === 'recipientEpoch') await db.manager.update(User, 2, { authVersion: 1 });
    if (kind === 'recipientMove')
      await db.manager.update(EnterpriseMembership, 2, { organizationId: 20 });
    if (kind === 'organizationVersion')
      await db.manager.update(EnterpriseOrganization, 10, { version: 2 });
    if (kind === 'intentCancel')
      await db.manager.update(EnterpriseHandoverProposal, p.requestId, { status: 'cancelled' });
    if (kind === 'title') await db.manager.update(Dashboard, 21, { title: 'Changed' });
    const before = await snapshot();
    await http('post', p.requestId + '/transfer/execute', 1, terms(accepted)).expect(
      kind === 'actorEpoch' ? 401 : 409,
    );
    expect(await snapshot()).toEqual(before);
  });
  it('read fresh linearization rejects status changes after snapshot without old titles', async () => {
    const { proposal: p, row } = await prepare();
    const original = db.transaction.bind(db);
    let injected = false;
    jest.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const result = await original(...(args as [any]));
      if (!injected) {
        injected = true;
        await db.manager.update(EnterpriseHandoverTransfer, p.requestId, {
          status: 'cancelled',
          version: row.version + 1,
        });
      }
      return result;
    });
    await http('get', p.requestId + '/transfer', 2).expect(409);
  });
  it('read fresh authority rejects token revoked after the read snapshot', async () => {
    const { proposal: p } = await prepare();
    const original = db.transaction.bind(db);
    let injected = false;
    jest.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const result = await original(...(args as [any]));
      if (!injected) {
        injected = true;
        await db.manager.update(User, 2, { authVersion: 1 });
      }
      return result;
    });
    await http('get', p.requestId + '/transfer', 2).expect(401);
  });
  it('same UUID payload replay is exact; changed UUID/input409 without additional audit', async () => {
    const { proposal: p, body, row } = await prepare();
    const before = await snapshot();
    expect(await service.prepare(p.requestId, 1, 0, body)).toEqual({ ...row, replayed: true });
    await http('post', p.requestId + '/transfer', 1, { ...body, requestId: randomUUID() }).expect(
      409,
    );
    await http('post', p.requestId + '/transfer', 1, { ...body, basis: 'b'.repeat(64) }).expect(
      409,
    );
    expect(await snapshot()).toEqual(before);
  });
  it('additive migration preflight accepts expected schema and rejects malformed columns without changes', async () => {
    const runner = db.createQueryRunner(),
      migration = new AddHandoverTransfer1792610000000();
    await runner.connect();
    try {
      await migration.up(runner);
      const table = await runner.getTable('enterprise_handover_transfer');
      expect(table.findColumnByName('completedAuditId').isNullable).toBe(true);
      const original = runner.getTable.bind(runner);
      jest.spyOn(runner, 'getTable').mockImplementation(async name => {
        const t = await original(name);
        t.findColumnByName('basisHash').length = '12';
        return t;
      });
      const before = await snapshot();
      await expect(migration.up(runner)).rejects.toThrow('preflight');
      expect(await snapshot()).toEqual(before);
    } finally {
      await runner.release();
    }
  });
  it('rechecks review children after the snapshot and rejects a committed Widget change', async () => {
    await canonical();
    const p = await newIntent();
    const original = db.transaction.bind(db);
    let injected = false;
    jest.spyOn(db, 'transaction').mockImplementation(async (...args: any[]) => {
      const result = await original(...(args as [any]));
      if (!injected) {
        injected = true;
        await db.manager.update(Widget, 71, { title: 'Changed after snapshot' });
      }
      return result;
    });
    await http('get', p.requestId + '/transfer-review').expect(409);
  });
  it('rechecks current Metric metadata before acceptance rather than trusting the dashboard row', async () => {
    await canonical();
    await db.manager.insert(Metric, {
      id: 91,
      databaseId: 11,
      name: 'synthetic_count',
      tableName: 'uploaded_data',
      aggregation: MetricAggregation.COUNT,
      expression: '*',
      definition: JSON.stringify({
        schemaVersion: 1,
        sourceId: 11,
        definitionVersion: 1,
        aggregation: 'COUNT',
        column: '*',
      }),
    });
    const { proposal: p, row } = await prepare();
    await db.manager.update(Metric, 91, { description: 'Changed after final preparation' });
    const before = await snapshot();
    await http('post', p.requestId + '/transfer/accept', 2, terms(row)).expect(409);
    expect(await snapshot()).toEqual(before);
  });
  it('allows the last signed-int asset version increment and rejects the next one', async () => {
    await db.manager.update(Dashboard, 21, { assetVersion: 2147483646 });
    const { proposal: p, row } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    await service.change(p.requestId, 1, 0, terms(accepted), 'execute');
    expect(await db.manager.findOneBy(Dashboard, { id: 21 })).toMatchObject({
      assetVersion: 2147483647,
    });
  });
  it('creates its additive schema from scratch and preserves exact linked audit columns', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await runner.dropTable('enterprise_handover_transfer');
      const migration = new AddHandoverTransfer1792610000000();
      await migration.up(runner);
      await migration.up(runner);
      const table = await runner.getTable('enterprise_handover_transfer');
      expect(table.primaryColumns.map(c => c.name)).toEqual(['proposalId']);
      for (const name of [
        'preparedAuditId',
        'acceptedAuditId',
        'completedAuditId',
        'cancelledAuditId',
      ])
        expect(table.findColumnByName(name)).toBeDefined();
      await expect(migration.down()).rejects.toThrow('retention');
    } finally {
      await runner.release();
    }
  });
  it('concurrent exact execute requests result in one completion event and one historical replay', async () => {
    const { proposal: p, row } = await prepare();
    const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
    const results = await Promise.all([
      service.change(p.requestId, 1, 0, terms(accepted), 'execute'),
      service.change(p.requestId, 1, 0, terms(accepted), 'execute'),
    ]);
    expect(results.map(r => r.replayed).sort()).toEqual([false, true]);
    expect(
      await db.manager.count(EnterpriseAuditEvent, {
        where: { action: 'handover.transfer.completed' },
      }),
    ).toBe(1);
    expect(await db.manager.findOneBy(Dashboard, { id: 21 })).toMatchObject({ assetVersion: 1 });
  });
  it.each(['accept', 'execute'] as const)(
    '%s rejects final expiry reached while awaiting a parent lock, with zero writes',
    async action => {
      await canonical();
      const { proposal: p, row } = await prepare();
      const current =
        action === 'execute' ? await service.change(p.requestId, 2, 0, terms(row), 'accept') : row;
      const before = await snapshot();
      let entered: () => void, release: () => void;
      const reachedParent = new Promise<void>(resolve => (entered = resolve));
      const gate = new Promise<void>(resolve => (release = resolve));
      const original = EntityManager.prototype.findOne;
      let held = false;
      jest
        .spyOn(EntityManager.prototype, 'findOne')
        .mockImplementation(async function (entity: any, options: any) {
          const result = await original.call(this, entity, options);
          if (
            !held &&
            entity === Dashboard &&
            options.where?.id === 21 &&
            this.queryRunner?.isTransactionActive
          ) {
            held = true;
            entered();
            await gate;
          }
          return result;
        });
      const changing = service
        .change(p.requestId, action === 'accept' ? 2 : 1, 0, terms(current), action)
        .then(
          v => ({ v }),
          e => ({ e }),
        );
      try {
        await reachedParent;
        // The final row was live at admission; its 15-minute window elapses during
        // the real service await, while the original 24-hour intent remains live.
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse(current.expiresAt) + 1);
        release();
        expect(((await changing) as any).e).toMatchObject({ status: 409 });
        expect(await snapshot()).toEqual(before);
      } finally {
        release();
        await changing;
      }
    },
  );
  const mysql = process.env.VM_SEMANTIC_MYSQL_CONFIG ? it : it.skip;
  mysql.each(['widget', 'dataset'])(
    'MySQL raw %s DELETE waits for the validated transfer to commit',
    async kind => {
      await canonical();
      const { proposal: p, row } = await prepare();
      const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
      let release: () => void, entered: () => void;
      const held = new Promise<void>(resolve => (entered = resolve)),
        gate = new Promise<void>(resolve => (release = resolve));
      const original = EntityManager.prototype.update;
      let paused = false;
      jest
        .spyOn(EntityManager.prototype, 'update')
        .mockImplementation(async function (entity: any, criteria: any, update: any) {
          const result = await original.call(this, entity, criteria, update);
          if (!paused && entity === UserMapping && update.userInfoId === 2) {
            paused = true;
            entered();
            await gate;
          }
          return result;
        });
      const executing = service.change(p.requestId, 1, 0, terms(accepted), 'execute');
      await held;
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction('READ COMMITTED');
      try {
        let settled = false;
        const deleting = runner.manager
          .delete(kind === 'widget' ? Widget : Dataset, kind === 'widget' ? 71 : 61)
          .finally(() => (settled = true));
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(settled).toBe(false);
        release();
        const result = await executing;
        expect(result.status).toBe('completed');
        expect((await deleting).affected).toBe(1);
        await runner.commitTransaction();
        expect(await db.manager.findOneBy(UserMapping, { id: 41 })).toMatchObject({
          userInfoId: 2,
        });
        expect(
          await db.manager.count(EnterpriseAuditEvent, {
            where: { action: 'handover.transfer.completed' },
          }),
        ).toBe(1);
      } finally {
        release();
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    },
  );
  mysql.each(['widget', 'dataset'])(
    'MySQL transfer waits for an earlier raw %s DELETE and rejects the missing child',
    async kind => {
      await canonical();
      const { proposal: p, row } = await prepare();
      const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction('READ COMMITTED');
      try {
        await runner.manager.delete(
          kind === 'widget' ? Widget : Dataset,
          kind === 'widget' ? 71 : 61,
        );
        let settled = false;
        const executing = service
          .change(p.requestId, 1, 0, terms(accepted), 'execute')
          .then(
            v => ({ v }),
            e => ({ e }),
          )
          .finally(() => (settled = true));
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(settled).toBe(false);
        await runner.commitTransaction();
        expect(((await executing) as any).e).toMatchObject({ status: 409 });
        expect(await db.manager.findOneBy(UserMapping, { id: 41 })).toMatchObject({
          userInfoId: 1,
        });
        expect(await db.manager.findOneBy(Dashboard, { id: 21 })).toMatchObject({
          assetVersion: 0,
        });
        expect(
          await db.manager.findOneBy(EnterpriseHandoverTransfer, { proposalId: p.requestId }),
        ).toMatchObject({ status: 'accepted', version: 2, completedAuditId: null });
        expect(
          await db.manager.count(EnterpriseAuditEvent, {
            where: { action: 'handover.transfer.completed' },
          }),
        ).toBe(0);
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    },
  );
  mysql.each(['create', 'update'])(
    'MySQL actual DashboardService %s waits transfer parent then rejects late old-owner attachment',
    async action => {
      await canonical();
      const { proposal: p, row } = await prepare();
      const accepted = await service.change(p.requestId, 2, 0, terms(row), 'accept');
      let release: () => void, entered: () => void;
      const held = new Promise<void>(resolve => (entered = resolve)),
        gate = new Promise<void>(resolve => (release = resolve));
      const original = EntityManager.prototype.update;
      let paused = false;
      jest
        .spyOn(EntityManager.prototype, 'update')
        .mockImplementation(async function (entity: any, criteria: any, update: any) {
          const result = await original.call(this, entity, criteria, update);
          if (!paused && entity === UserMapping && update.userInfoId === 2) {
            paused = true;
            entered();
            await gate;
          }
          return result;
        });
      const executing = service.change(p.requestId, 1, 0, terms(accepted), 'execute');
      await held;
      let settled = false;
      const body = { title: 'Late attach', layout: [{ i: '71', x: 0, y: 0, w: 6, h: 2 }] } as any;
      const late = (
        action === 'create'
          ? dashboardService().create(body, 1)
          : dashboardService().update(22, body, 1)
      )
        .then(
          v => ({ v }),
          e => ({ e }),
        )
        .finally(() => (settled = true));
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(settled).toBe(false);
      release();
      await executing;
      const result = await late;
      expect((result as any).e).toMatchObject({ status: 403 });
      expect(await db.manager.count(Dashboard)).toBe(2);
      expect(await db.manager.count(DashboardWidget)).toBe(1);
      expect(await db.manager.findOneBy(Dashboard, { id: 22 })).toMatchObject({
        title: 'Second dashboard',
      });
    },
  );
  mysql(
    'MySQL source parent writer commit after waiting invalidates final basis under READ COMMITTED',
    async () => {
      await canonical();
      const { proposal: p, row } = await prepare();
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction('READ COMMITTED');
      try {
        await runner.manager.findOne(Database, {
          where: { id: 11 },
          lock: { mode: 'pessimistic_write' },
        });
        let settled = false;
        const accepting = service
          .change(p.requestId, 2, 0, terms(row), 'accept')
          .then(
            v => ({ v }),
            e => ({ e }),
          )
          .finally(() => (settled = true));
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(settled).toBe(false);
        await runner.manager.update(Database, 11, { name: 'Changed while waiting' });
        await runner.commitTransaction();
        expect(((await accepting) as any).e).toMatchObject({ status: 409 });
        expect(
          await db.manager.findOneBy(EnterpriseHandoverTransfer, { proposalId: p.requestId }),
        ).toMatchObject({ status: 'prepared', version: 1 });
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await runner.release();
      }
    },
  );
});
