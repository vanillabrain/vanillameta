jest.mock('ai', () => ({ generateText: jest.fn(), streamText: jest.fn(), tool: jest.fn() }));
jest.mock('@ai-sdk/provider', () => ({}));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DashboardRevision } from '../dashboard-studio/entities/dashboard-revision.entity';
import { Database } from '../database/entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseDashboardDelivery } from '../enterprise/entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from '../enterprise/entities/enterprise-group-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
} from '../enterprise/entities/enterprise-group.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseNotificationAudience } from '../enterprise/entities/enterprise-notification-audience.entity';
import { EnterpriseNotificationState } from '../enterprise/entities/enterprise-notification-state.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { User } from '../user/entities/user.entity';
import { Widget } from '../widget/entities/widget.entity';
import { DashboardToolException } from './mcp-dashboard.errors';
import { ActorWindowLimiter } from './mcp-dashboard.limits';
import { McpDashboardService } from './mcp-dashboard.service';
import { mcpError } from './mcp-server';
import type { McpOAuthPrincipal } from './mcp-oauth.service';

const principal = (over: Partial<McpOAuthPrincipal> = {}): McpOAuthPrincipal => ({
  actorId: 2,
  authVersion: 0,
  grantId: 'grant-1',
  organizationId: 1,
  clientName: 'Synthetic AI',
  scopes: ['dashboards:read', 'dashboards:write'],
  ...over,
});

const BLOCKS = [
  { title: 'Revenue', kind: 'BOARD_NUMERIC', metric: { id: 11, definitionVersion: 1 } },
];
const SPEC = { sourceId: 101, title: 'Sales', blocks: BLOCKS };
const REQUEST_ID = '5f0d3a6e-8c57-4a2b-9d51-0d6a5b1c7e42';
const DIGEST = 'a'.repeat(64);
const CREATE = {
  ...SPEC,
  previewDigest: DIGEST,
  expectedSourceRevision: 'b'.repeat(64),
  requestId: REQUEST_ID,
};

describe('McpDashboardService', () => {
  let db: DataSource;
  let service: McpDashboardService;
  let policy: EnterpriseResourcePolicyService;
  const auth = { revalidate: jest.fn(), assertGrant: jest.fn() };
  const studio = { readDocument: jest.fn() };
  const creation = { previewSpec: jest.fn(), createFromSpec: jest.fn() };

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        EnterpriseNotificationState,
        User,
        UserMapping,
        EnterpriseOrganization,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseNotificationAudience,
        EnterpriseResourceGrant,
        EnterpriseGroup,
        EnterpriseGroupMember,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
        Database,
        Dashboard,
        Widget,
        DashboardWidget,
        Dataset,
        DashboardRevision,
      ],
    }).initialize();
    policy = new EnterpriseResourcePolicyService(db);
    service = new McpDashboardService(
      db,
      policy,
      studio as never,
      creation as never,
      auth as never,
    );
  });
  afterAll(async () => db?.destroy());

  beforeEach(async () => {
    jest.resetAllMocks();
    service.limiter = new ActorWindowLimiter();
    for (const entity of [
      DashboardRevision,
      EnterpriseResourceGrant,
      UserMapping,
      Dashboard,
      Database,
      EnterpriseMembership,
      EnterpriseOrganization,
      User,
    ])
      await db.getRepository(entity as never).clear();
    await db.getRepository(User).save(
      [1, 2, 3].map(id => ({
        id,
        userId: `account-${id}`,
        email: `account-${id}@example.invalid`,
        password: 'x',
        active: true,
        authVersion: 0,
      })),
    );
    await db.getRepository(EnterpriseOrganization).save({ id: 1, name: 'Org', version: 1 });
    await db.getRepository(EnterpriseMembership).save([
      { userId: 1, organizationId: 1, role: 'admin', team: '' },
      { userId: 2, organizationId: 1, role: 'contributor', team: '' },
      { userId: 3, organizationId: 1, role: 'editor', team: '' },
    ]);
    const source = (id: number, ownerId: number, name: string) => ({
      id,
      ownerId,
      name,
      description: '',
      connectionConfig: '{}',
      engine: 'mysql',
      type: 'mysql',
      timezone: 'UTC',
    });
    await db
      .getRepository(Database)
      .save([source(101, 2, 'Mine'), source(102, 3, 'Theirs')] as never);
  });

  const dashboard = async (id: number, owners: number[], over: Partial<Dashboard> = {}) => {
    await db.getRepository(Dashboard).save({ id, title: `Dashboard ${id}`, ...over } as never);
    for (const owner of owners)
      await db.getRepository(UserMapping).save({ dashboardId: id, userInfoId: owner });
  };

  describe('grade and scope', () => {
    it('refuses a call without the approved scope before anything else is read', async () => {
      await expect(
        service.list(principal({ scopes: ['dashboards:write'] })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.preview(principal({ scopes: ['dashboards:read'] }), SPEC),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(auth.revalidate).not.toHaveBeenCalled();
      expect(creation.previewSpec).not.toHaveBeenCalled();
    });

    it('lets a viewer read but not write, and refuses a role the table does not know', async () => {
      const members = db.getRepository(EnterpriseMembership);
      await members.update({ userId: 2 }, { role: 'viewer' });
      await expect(service.list(principal())).resolves.toEqual({
        dashboards: [],
        nextAfterId: null,
      });
      await expect(service.preview(principal(), SPEC)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.create(principal(), CREATE)).rejects.toBeInstanceOf(ForbiddenException);
      await members.update({ userId: 2 }, { role: 'owner' as never });
      await expect(service.list(principal())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses an account in another organization than the connection was approved for', async () => {
      await expect(service.list(principal({ organizationId: 9 }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('list and read', () => {
    it('lists only live, active dashboards the account alone owns', async () => {
      await dashboard(1, [2]);
      await dashboard(2, [2, 3]);
      await dashboard(3, [3]);
      await dashboard(4, [2], { delYn: 'Y' });
      await dashboard(5, [2], { assetActive: false });
      await dashboard(6, [2]);
      const page = await service.list(principal());
      expect(page.dashboards.map(d => d.dashboardId)).toEqual([1, 6]);
      // The list and the per-dashboard check must agree on every fixture.
      for (const id of [1, 2, 3, 4, 5, 6]) {
        const listed = page.dashboards.some(d => d.dashboardId === id);
        await expect(
          policy.assertSoleOwner(id, 2).then(
            () => true,
            () => false,
          ),
        ).resolves.toBe(listed);
      }
    });

    it('pages by id', async () => {
      for (let id = 1; id <= 51; id += 1) await dashboard(id, [2]);
      const first = await service.list(principal());
      expect(first.dashboards).toHaveLength(50);
      expect(first.nextAfterId).toBe(50);
      expect((await service.list(principal(), 50)).dashboards.map(d => d.dashboardId)).toEqual([
        51,
      ]);
    });

    it('refuses to read what the account does not alone own, an admin and an editor included', async () => {
      await dashboard(10, [3]);
      await dashboard(11, [2, 3]);
      await dashboard(12, [2], { assetActive: false });
      await policy.set('dashboard', 10, 1, {
        recipientId: 2,
        expectedVersion: 0,
        rights: { read: true, edit: true, publish: false, export: false },
      });
      for (const id of [10, 11, 12, 999])
        await expect(service.read(principal(), id)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.read(principal({ actorId: 1 }), 10)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(studio.readDocument).not.toHaveBeenCalled();
    });

    it('returns the document and a history summary that carries no stored document or ids', async () => {
      await dashboard(20, [2]);
      studio.readDocument.mockResolvedValue({
        document: { title: 'Dash', revision: 'rev-2', blocks: [] },
        sourceName: 'Mine',
        sourceRevision: 'src',
      });
      const rows = [
        {
          revisionId: 'r-1',
          revision: 'rev-1',
          operation: 'create',
          authorKind: 'human',
          actorId: 2,
        },
        {
          revisionId: 'r-2',
          revision: 'rev-2',
          operation: 'save',
          authorKind: 'external-ai',
          actorId: 2,
          aiGrantId: 'secret-grant',
          aiClientName: 'Synthetic AI',
        },
        {
          revisionId: 'r-3',
          revision: 'rev-0',
          operation: 'save',
          authorKind: 'human',
          actorId: 3,
        },
      ];
      for (const [i, row] of rows.entries())
        await db.getRepository(DashboardRevision).insert({
          dashboardId: 20,
          studioDocument: '{"secret":"document"}',
          title: 'T',
          layout: '[]',
          createdAt: `2026-11-0${i + 1}T00:00:00.000Z`,
          ...row,
        } as never);
      const read = await service.read(principal(), 20);
      expect(read).toMatchObject({ dashboardId: 20, revision: 'rev-2', sourceName: 'Mine' });
      expect(read.history.map(h => h.revisionId)).toEqual(['r-3', 'r-2', 'r-1']);
      expect(read.history[1]).toEqual({
        revisionId: 'r-2',
        createdAt: '2026-11-02T00:00:00.000Z',
        operation: 'save',
        authorKind: 'external-ai',
        clientName: 'Synthetic AI',
        byYou: true,
        isCurrent: true,
      });
      expect(read.history[0]).toMatchObject({ byYou: false, isCurrent: false });
      const text = JSON.stringify(read.history);
      expect(text).not.toContain('secret');
      expect(text).not.toContain('actorId');
    });

    it('refuses when ownership moves while the document is read', async () => {
      await dashboard(30, [2]);
      studio.readDocument.mockImplementation(async () => {
        await db.getRepository(UserMapping).save({ dashboardId: 30, userInfoId: 3 });
        return { document: { title: 'T', revision: 'r' }, sourceName: 'S', sourceRevision: 's' };
      });
      await expect(service.read(principal(), 30)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does not return what it read when the connection is revoked meanwhile', async () => {
      await dashboard(31, [2]);
      studio.readDocument.mockResolvedValue({
        document: { title: 'T', revision: 'r' },
        sourceName: 'S',
        sourceRevision: 's',
      });
      auth.revalidate.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('revoked'));
      await expect(service.read(principal(), 31)).rejects.toThrow('revoked');
    });

    it('rejects a page cursor that is not a non-negative integer', async () => {
      await expect(service.list(principal(), undefined)).resolves.toBeDefined();
      for (const afterId of ['1', -1, 1.5, NaN, null])
        expect(mcpError(await service.list(principal(), afterId).catch(e => e))).toMatchObject({
          code: 'INVALID',
          detail: { reason: 'INVALID_INPUT' },
        });
    });
  });

  describe('preview', () => {
    const widget = {
      title: 'Revenue',
      type: 'BOARD_NUMERIC',
      valueField: 'value',
      sql: 'SELECT secret FROM t',
      datas: [{ value: 5, extra: 'x' }],
    };

    it('returns values without the query text', async () => {
      creation.previewSpec.mockResolvedValue({
        previewDigest: DIGEST,
        sourceRevision: 'src',
        preview: { widgets: [widget] },
      });
      const result = await service.preview(principal(), SPEC);
      expect(result.blocks).toEqual([
        {
          index: 0,
          title: 'Revenue',
          type: 'BOARD_NUMERIC',
          valueField: 'value',
          rowCount: 1,
          truncated: false,
          rows: [{ value: 5 }],
        },
      ]);
      expect(JSON.stringify(result)).not.toContain('secret');
      expect(creation.previewSpec).toHaveBeenCalledWith(SPEC, 2, 0);
    });

    it('says how many rows a block has and when it was cut, and tolerates a block with no rows', async () => {
      creation.previewSpec.mockResolvedValue({
        previewDigest: DIGEST,
        sourceRevision: 's',
        preview: {
          widgets: [
            {
              title: 'Many',
              type: 'CHART_BAR',
              valueField: 'v',
              datas: Array.from({ length: 250 }, (_, i) => ({ v: i })),
            },
            { title: 'None', type: 'BOARD_NUMERIC', valueField: 'v' },
          ],
        },
      });
      const { blocks } = await service.preview(principal(), SPEC);
      expect(blocks[0]).toMatchObject({ rowCount: 250, truncated: true });
      expect(blocks[0].rows).toHaveLength(100);
      expect(blocks[1]).toMatchObject({ rowCount: 0, truncated: false, rows: [] });
    });

    it('builds only from a source the account owns', async () => {
      await expect(service.preview(principal(), { ...SPEC, sourceId: 102 })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.preview(principal(), { ...SPEC, sourceId: 999 })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(creation.previewSpec).not.toHaveBeenCalled();
    });

    it('calls blocks that are not a list malformed input, not an unsupported change', async () => {
      const error = await service.preview(principal(), { ...SPEC, blocks: 'nope' }).catch(e => e);
      expect(mcpError(error)).toMatchObject({ detail: { reason: 'INVALID_INPUT' } });
    });

    it('refuses a block that is not a saved metric before the kernel is reached', async () => {
      for (const blocks of [
        [{ title: 'x', kind: 'BOARD_NUMERIC', metric: { aggregation: 'SUM', column: 'a' } }],
        [{ title: 'x', kind: 'BOARD_NUMERIC' }],
      ]) {
        const error = await service.preview(principal(), { ...SPEC, blocks }).catch(e => e);
        expect(mcpError(error)).toMatchObject({
          code: 'INVALID',
          detail: { reason: 'UNSUPPORTED_CHANGE' },
        });
      }
      expect(creation.previewSpec).not.toHaveBeenCalled();
    });

    it('limits previews per account, not per connection', async () => {
      let now = 1_000;
      service.limiter = new ActorWindowLimiter(() => now);
      creation.previewSpec.mockResolvedValue({
        previewDigest: DIGEST,
        sourceRevision: 's',
        preview: { widgets: [] },
      });
      for (let i = 0; i < 10; i += 1) await service.preview(principal(), SPEC);
      const other = principal({ grantId: 'grant-2' });
      const error = await service.preview(other, SPEC).catch(e => e);
      expect(mcpError(error)).toMatchObject({ code: 'LIMIT', detail: { reason: 'RATE_LIMITED' } });
      now += 60_001;
      await expect(service.preview(principal(), SPEC)).resolves.toBeDefined();
    });

    it('reports the row cap and stale data as codes, not as Korean text', async () => {
      creation.previewSpec.mockRejectedValueOnce(
        new BadRequestException({ code: 'CARDINALITY_LIMIT', message: '차원의 값이 500개를 넘어' }),
      );
      expect(mcpError(await service.preview(principal(), SPEC).catch(e => e))).toMatchObject({
        code: 'INVALID',
        detail: { reason: 'CARDINALITY_LIMIT' },
      });
      creation.previewSpec.mockRejectedValueOnce(
        new ConflictException({ code: 'SOURCE_CHANGED', message: '미리보기 중 데이터가 변경' }),
      );
      expect(mcpError(await service.preview(principal(), SPEC).catch(e => e))).toMatchObject({
        code: 'CONFLICT',
        detail: { reason: 'SOURCE_CHANGED' },
      });
    });
  });

  describe('create', () => {
    it('saves as the connection, with the grant and grade read under the save lock', async () => {
      creation.createFromSpec.mockImplementation(async (_b, _a, _v, options) => {
        await options.beforeAccess(db.manager);
        return { dashboardId: 77, document: { revision: 'rev-1' } };
      });
      await expect(service.create(principal(), CREATE)).resolves.toEqual({
        dashboardId: 77,
        revision: 'rev-1',
      });
      const [body, actor, authVersion, options] = creation.createFromSpec.mock.calls[0];
      expect(body).toEqual(CREATE);
      expect([actor, authVersion]).toEqual([2, 0]);
      expect(options.author).toEqual({
        kind: 'external-ai',
        grantId: 'grant-1',
        clientName: 'Synthetic AI',
      });
      expect(auth.assertGrant).toHaveBeenCalledWith(db.manager, principal(), 'dashboards:write');
    });

    it('refuses the save when the grade falls while the creation waits', async () => {
      creation.createFromSpec.mockImplementation(async (_b, _a, _v, options) => {
        await db.getRepository(EnterpriseMembership).update({ userId: 2 }, { role: 'viewer' });
        await options.beforeAccess(db.manager);
        return { dashboardId: 77, document: { revision: 'rev-1' } };
      });
      await expect(service.create(principal(), CREATE)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('requires a version 4 UUID request id', async () => {
      for (const requestId of ['abc', undefined, '5f0d3a6e-8c57-1a2b-9d51-0d6a5b1c7e42'])
        expect(
          mcpError(await service.create(principal(), { ...CREATE, requestId }).catch(e => e)),
        ).toMatchObject({ code: 'INVALID' });
      expect(creation.createFromSpec).not.toHaveBeenCalled();
    });

    it('turns a reused request id into REQUEST_REUSED, so the agent does not retry it forever', async () => {
      creation.createFromSpec.mockRejectedValue(
        new ConflictException({ code: 'REQUEST_REUSED', message: '같은 요청 ID에 다른 생성' }),
      );
      expect(mcpError(await service.create(principal(), CREATE).catch(e => e))).toMatchObject({
        code: 'REQUEST_REUSED',
        retryable: false,
        detail: { reason: 'REQUEST_REUSED' },
      });
    });

    it('maps a stale preview and a full write queue', async () => {
      creation.createFromSpec.mockRejectedValueOnce(
        new ConflictException({ code: 'PREVIEW_STALE', message: '미리보기 이후' }),
      );
      expect(mcpError(await service.create(principal(), CREATE).catch(e => e))).toMatchObject({
        code: 'CONFLICT',
        detail: { reason: 'PREVIEW_STALE' },
      });
      creation.createFromSpec.mockRejectedValueOnce(
        new ServiceUnavailableException({ code: 'QUEUE_FULL', message: '많습니다' }),
      );
      expect(mcpError(await service.create(principal(), CREATE).catch(e => e))).toMatchObject({
        code: 'CONFLICT',
        retryable: true,
        detail: { reason: 'QUEUE_FULL' },
      });
    });

    it('tells an agent which conflicts to retry after reading again, and which not to retry', async () => {
      const reasons = [
        ['REVISION_CHANGED', 'CONFLICT', true],
        ['SOURCE_CHANGED', 'CONFLICT', true],
        ['STATE_CHANGED', 'CONFLICT', true],
        // The saved state cannot be rebuilt on today's data; asking again cannot help.
        ['RESTORE_STALE', 'INVALID', false],
        ['REQUEST_REUSED', 'REQUEST_REUSED', false],
      ] as const;
      for (const [reason, code, retryable] of reasons) {
        creation.createFromSpec.mockRejectedValueOnce(
          new ConflictException({ code: reason, message: '한국어 문장' }),
        );
        expect(mcpError(await service.create(principal(), CREATE).catch(e => e))).toMatchObject({
          code,
          retryable,
          detail: { reason },
        });
      }
    });

    it('names an unlabelled 409 as a state change and leaves a busy worker alone', async () => {
      creation.createFromSpec.mockRejectedValueOnce(
        new ConflictException('데이터 파일이 교체되었습니다.'),
      );
      expect(mcpError(await service.create(principal(), CREATE).catch(e => e))).toMatchObject({
        code: 'CONFLICT',
        detail: { reason: 'STATE_CHANGED' },
      });
      // A busy worker is retryable later, and is not a permission problem.
      creation.createFromSpec.mockRejectedValueOnce(new ServiceUnavailableException('worker busy'));
      expect(mcpError(await service.create(principal(), CREATE).catch(e => e))).toMatchObject({
        code: 'CONFLICT',
        retryable: true,
        detail: { reason: 'BUSY' },
      });
      // A 409 that carries a code this layer does not know is not renamed.
      const unknown = new ConflictException({ code: 'SOMETHING_ELSE', message: 'x' });
      creation.createFromSpec.mockRejectedValueOnce(unknown);
      expect(await service.create(principal(), CREATE).catch(e => e)).toBe(unknown);
      // An unreadable earlier record is "look it up", never "preview and try again".
      creation.createFromSpec.mockRejectedValueOnce(
        new ConflictException({ code: 'REPLAY_UNREADABLE', message: 'x' }),
      );
      expect(mcpError(await service.create(principal(), CREATE).catch(e => e))).toMatchObject({
        code: 'REQUEST_REUSED',
      });
    });

    it('does not turn a refusal or a bug into one of these codes', async () => {
      creation.createFromSpec.mockRejectedValueOnce(new ForbiddenException());
      expect(await service.create(principal(), CREATE).catch(e => e)).toBeInstanceOf(
        ForbiddenException,
      );
      const bug = new Error('boom');
      creation.createFromSpec.mockRejectedValueOnce(bug);
      expect(await service.create(principal(), CREATE).catch(e => e)).toBe(bug);
    });

    it('limits creations to 10 an hour per account', async () => {
      let now = 1_000;
      service.limiter = new ActorWindowLimiter(() => now);
      creation.createFromSpec.mockResolvedValue({ dashboardId: 1, document: { revision: 'r' } });
      for (let i = 0; i < 10; i += 1) {
        await service.create(principal(), CREATE);
        now += 5_000; // spaced out so the 20-a-minute write limit is not the one that trips
        if (i % 3 === 2) now += 60_000;
      }
      const error = await service.create(principal(), CREATE).catch(e => e);
      expect(error).toBeInstanceOf(DashboardToolException);
      expect(mcpError(error)).toMatchObject({ code: 'LIMIT', detail: { reason: 'RATE_LIMITED' } });
      now += 3_600_001;
      await expect(service.create(principal(), CREATE)).resolves.toBeDefined();
    });

    it('builds only from an owned source and a saved metric', async () => {
      await expect(
        service.create(principal(), { ...CREATE, sourceId: 102 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const bad = [{ title: 'x', kind: 'BOARD_NUMERIC', metric: { aggregation: 'SUM' } }];
      expect(
        mcpError(await service.create(principal(), { ...CREATE, blocks: bad }).catch(e => e)),
      ).toMatchObject({ detail: { reason: 'UNSUPPORTED_CHANGE' } });
      expect(creation.createFromSpec).not.toHaveBeenCalled();
    });
  });
});
