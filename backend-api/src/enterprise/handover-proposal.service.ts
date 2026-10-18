import { custodyMetadata, custodyRefresh, inspectHandoverCustody } from './handover-custody';
import { handoverSourceCoverage, handoverStorage } from './handover-dependencies';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { lockStaffWrite } from './staff-write-lock';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { lockMetricSources } from '../metric/metric-write-lock';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseHandoverProposal } from './entities/enterprise-handover-proposal.entity';

type Asset = { kind: 'source' | 'dashboard'; id: number; title: string };
type Manifest = Asset & { title: string; fingerprint: string };
function canonical(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonical(value[key])]),
    );
  return value;
}
const hash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');

@Injectable()
export class HandoverProposalService {
  constructor(private readonly db: DataSource) {}
  private keys(value: any, keys: string[]) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      Object.keys(value).some(k => !keys.includes(k))
    )
      throw new BadRequestException('인계 의향 요청 항목을 확인해 주세요.');
  }
  private id(value: unknown) {
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) >= 2147483647)
      throw new BadRequestException('직원·자료 번호를 확인해 주세요.');
    return Number(value);
  }
  private uuid(value: unknown) {
    if (
      typeof value !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
    )
      throw new BadRequestException('요청 UUID를 확인해 주세요.');
    return value;
  }
  private lock(manager: EntityManager) {
    return ['mysql', 'mariadb'].includes(manager.connection.options.type)
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {};
  }
  /** Internal enterprise workflow boundary; not an HTTP API. */
  async context(manager: EntityManager, actor: number, epoch: number, proposalId?: string) {
    const query = manager
      .createQueryBuilder(User, 'u')
      .leftJoin(EnterpriseMembership, 'm', 'm.userId = u.id')
      .leftJoin(EnterpriseOrganization, 'o', 'o.id = m.organizationId')
      .select('u.id', 'id')
      .addSelect('u.active', 'active')
      .addSelect('u.authVersion', 'epoch')
      .addSelect('m.organizationId', 'organizationId')
      .addSelect('m.role', 'role')
      .addSelect('m.team', 'team')
      .addSelect('o.id', 'orgId')
      .addSelect('o.version', 'organizationVersion')
      .where('u.id = :actor', { actor });
    if (proposalId) {
      query.leftJoin(EnterpriseHandoverProposal, 'p', 'p.requestId = :proposalId', { proposalId });
      this.privacyJoins(query);
      for (const field of ['version', 'status', 'reviewBasis', 'expiresAt'])
        query.addSelect(`p.${field}`, field);
    }
    const row = await query.getRawOne();
    if (
      !row ||
      !Number(row.active) ||
      !Number.isSafeInteger(epoch) ||
      Number(row.epoch ?? 0) !== epoch
    )
      throw new UnauthorizedException('로그인이 변경되었습니다. 다시 로그인해 주세요.');
    if (!row.orgId) throw new ForbiddenException('현재 조직 소속을 확인해 주세요.');
    return row;
  }
  private async read<T>(
    actor: number,
    epoch: number,
    run: (manager: EntityManager, scope: any) => Promise<T>,
    proposalId?: string,
    acceptedReview = false,
  ): Promise<T> {
    this.id(actor);
    return serializeMetadataWork(this.db, async () => {
      const snapshot = async (manager: EntityManager) => {
        const scope = await this.context(manager, actor, epoch, proposalId);
        return { scope, value: await run(manager, scope) };
      };
      const result = ['mysql', 'mariadb'].includes(this.db.options.type)
        ? await this.db.transaction('REPEATABLE READ', snapshot)
        : await this.db.transaction(snapshot);
      const fresh = await this.context(this.db.manager, actor, epoch, proposalId);
      if (Number(fresh.organizationId) !== Number(result.scope.organizationId))
        throw new ForbiddenException('현재 조직이 변경됐습니다.');
      if (hash(fresh) !== hash(result.scope))
        throw new ConflictException('조직 정보가 변경됐습니다. 다시 확인해 주세요.');
      if (proposalId && acceptedReview && new Date(fresh.expiresAt).getTime() <= Date.now())
        throw new ConflictException('인계 의향이 만료됐습니다.');
      if (proposalId && !acceptedReview) {
        const response = result.value as any;
        response.expired = Date.parse(response.expiresAt) <= Date.now();
        if (response.expired) {
          response.detailsAvailable = false;
          response.assets = [];
        }
      }
      return result.value;
    });
  }
  async candidates(actor: number, epoch: number, kind: unknown, afterId?: unknown) {
    if (kind !== 'source' && kind !== 'dashboard')
      throw new BadRequestException('자료 유형을 확인해 주세요.');
    let after = 0;
    if (afterId !== undefined) {
      if (typeof afterId !== 'string' || !/^[1-9]\d*$/.test(afterId))
        throw new BadRequestException('목록 위치를 확인해 주세요.');
      after = this.id(Number(afterId));
    }
    return this.read(actor, epoch, async manager => {
      const query =
        kind === 'source'
          ? manager
              .createQueryBuilder(Database, 'asset')
              .select('asset.id', 'id')
              .addSelect('asset.name', 'title')
              .where('asset.ownerId = :actor AND asset.catalogActive = :active', {
                actor,
                active: true,
              })
          : manager
              .createQueryBuilder(Dashboard, 'asset')
              .select('asset.id', 'id')
              .addSelect('asset.title', 'title')
              .where('asset.assetActive = :active AND asset.delYn = :notDeleted', {
                active: true,
                notDeleted: 'N',
              });
      if (kind === 'dashboard') {
        const own = query
          .subQuery()
          .select('1')
          .from(UserMapping, 'own')
          .where('own.dashboardId = asset.id AND own.userInfoId = :actor')
          .getQuery();
        const count = query
          .subQuery()
          .select('COUNT(*)')
          .from(UserMapping, 'mapping')
          .where('mapping.dashboardId = asset.id')
          .getQuery();
        query.andWhere(`EXISTS ${own}`).andWhere(`${count} = 1`).setParameter('actor', actor);
      }
      const rows = await query
        .andWhere('asset.id > :after', { after })
        .orderBy('asset.id', 'ASC')
        .limit(21)
        .getRawMany();
      return {
        entries: rows
          .slice(0, 20)
          .map(row => ({ kind, id: Number(row.id), title: String(row.title).slice(0, 300) })),
        nextAfterId: rows.length > 20 ? Number(rows[19].id) : null,
      };
    });
  }
  private privacyJoins(query: any) {
    query
      .leftJoin(User, 'ownerAccount', 'ownerAccount.id = p.ownerId')
      .leftJoin(User, 'recipientAccount', 'recipientAccount.id = p.recipientId')
      .leftJoin(EnterpriseMembership, 'ownerMembership', 'ownerMembership.userId = p.ownerId')
      .leftJoin(
        EnterpriseMembership,
        'recipientMembership',
        'recipientMembership.userId = p.recipientId',
      );
    for (const [field, alias] of [
      ['ownerAccount.active', 'ownerActive'],
      ['recipientAccount.active', 'recipientActive'],
      ['ownerAccount.authVersion', 'ownerEpoch'],
      ['recipientAccount.authVersion', 'recipientEpoch'],
      ['ownerMembership.organizationId', 'ownerOrg'],
      ['recipientMembership.organizationId', 'recipientOrg'],
    ])
      query.addSelect(field, alias);
  }
  /** Internal enterprise workflow boundary; not an HTTP API. */
  available(basis: any, row: EnterpriseHandoverProposal) {
    return (
      row.status !== 'cancelled' &&
      row.expiresAt.getTime() > Date.now() &&
      Boolean(Number(basis.ownerActive)) &&
      Boolean(Number(basis.recipientActive)) &&
      Number(basis.ownerEpoch) === row.ownerAuthVersion &&
      Number(basis.recipientEpoch) === row.recipientAuthVersion &&
      Number(basis.ownerOrg) === row.organizationId &&
      Number(basis.recipientOrg) === row.organizationId
    );
  }
  private async project(manager: EntityManager, row: EnterpriseHandoverProposal) {
    const query = manager
      .createQueryBuilder(EnterpriseHandoverProposal, 'p')
      .select('p.requestId', 'requestId')
      .where('p.requestId = :id', { id: row.requestId });
    this.privacyJoins(query);
    return this.view(row, this.available(await query.getRawOne(), row));
  }
  private async write<T>(run: (manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await (['mysql', 'mariadb'].includes(this.db.options.type)
        ? metadataTransaction(this.db, 'READ COMMITTED', run)
        : metadataTransaction(this.db, run));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (/UNIQUE|PRIMARY KEY/i.test(error.driverError?.message ?? '') ||
          [
            'SQLITE_BUSY',
            'SQLITE_LOCKED',
            'ER_DUP_ENTRY',
            'ER_LOCK_DEADLOCK',
            'ER_LOCK_WAIT_TIMEOUT',
          ].includes(error.driverError?.code))
      )
        throw new ConflictException(
          '인계 의향 요청이 경합 중입니다. 같은 UUID로 상태를 확인해 주세요.',
        );
      throw error;
    }
  }
  private view(row: EnterpriseHandoverProposal, available: boolean) {
    const manifest: Manifest[] = JSON.parse(row.manifestJson);
    return {
      requestId: row.requestId,
      organizationId: row.organizationId,
      ownerId: row.ownerId,
      recipientId: row.recipientId,
      version: row.version,
      status: row.status,
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      reviewBasis: row.reviewBasis,
      detailsAvailable: available,
      assets: available ? manifest.map(({ kind, id, title }) => ({ kind, id, title })) : [],
      expired: row.expiresAt.getTime() <= Date.now(),
    };
  }
  /** Internal enterprise workflow boundary; not an HTTP API. */
  access(row: EnterpriseHandoverProposal, actor: number, scope: any) {
    if (!row) throw new NotFoundException('인계 의향 요청을 찾을 수 없습니다.');
    if (
      ![row.ownerId, row.recipientId].includes(actor) ||
      row.organizationId !== Number(scope.organizationId)
    )
      throw new ForbiddenException('현재 조직의 본인 인계 의향만 확인할 수 있습니다.');
  }
  async detail(requestId: unknown, actor: number, epoch: number) {
    const id = this.uuid(requestId);
    return this.read(
      actor,
      epoch,
      async (manager, scope) => {
        const row = await manager.findOneBy(EnterpriseHandoverProposal, { requestId: id });
        this.access(row, actor, scope);
        return this.view(row, this.available(scope, row));
      },
      id,
    );
  }
  async dependencies(requestId: unknown, actor: number, epoch: number) {
    const id = this.uuid(requestId);
    return this.read(
      actor,
      epoch,
      async (manager, scope) => {
        const row = await this.acceptedOwner(manager, scope, id, actor);
        const manifest: Manifest[] = JSON.parse(row.manifestJson);
        const selectedSources = new Set(
          manifest.filter(asset => asset.kind === 'source').map(asset => asset.id),
        );
        const assets = [];
        for (const { kind, id, title } of manifest) {
          if (kind === 'dashboard') {
            assets.push({
              kind,
              id,
              title,
              ...(await handoverSourceCoverage(manager, actor, selectedSources, id)),
              metricCount: 0,
              storage: 'not_applicable',
            });
          } else {
            const source = await manager.findOneBy(Database, { id });
            const storage = handoverStorage(source.engine);
            assets.push({
              kind,
              id,
              title,
              dependencyStatus: storage === 'unresolved' ? 'unresolved' : 'covered',
              requiredSources: 0,
              selectedSources: 0,
              missingOwnedSources: 0,
              otherSources: 0,
              metricCount: await manager.count(Metric, { where: { databaseId: id } }),
              storage,
            });
          }
        }
        return {
          requestId: row.requestId,
          organizationId: row.organizationId,
          ownerId: row.ownerId,
          recipientId: row.recipientId,
          proposalVersion: row.version,
          checkedAt: new Date().toISOString(),
          scope: 'selected_dependencies_v1',
          executionAvailable: false,
          assets,
        };
      },
      id,
      true,
    );
  }
  private async acceptedOwner(manager: EntityManager, scope: any, id: string, actor: number) {
    const row = await manager.findOneBy(EnterpriseHandoverProposal, { requestId: id });
    this.access(row, actor, scope);
    if (row.ownerId !== actor)
      throw new ForbiddenException('소유자만 보관 조건을 검토할 수 있습니다.');
    if (row.status !== 'accepted' || row.acceptedAt === null || !this.available(scope, row))
      throw new ConflictException('현재 수락된 인계 의향을 다시 확인해 주세요.');
    const organization = await manager.findOneBy(EnterpriseOrganization, {
      id: row.organizationId,
    });
    await this.issued(manager, row, organization, true);
    return row;
  }
  async custody(requestId: unknown, actor: number, epoch: number) {
    const id = this.uuid(requestId);
    const captured = await this.read(
      actor,
      epoch,
      async (manager, scope) => {
        const row = await this.acceptedOwner(manager, scope, id, actor);
        const manifest: Manifest[] = JSON.parse(row.manifestJson);
        const sources = [];
        for (const asset of manifest.filter(asset => asset.kind === 'source')) {
          sources.push({
            asset,
            source: await manager.findOneBy(Database, { id: asset.id }),
            refresh: await custodyRefresh(manager, asset.id),
          });
        }
        return { row, sources, metadata: sources.length ? await custodyMetadata(manager) : null };
      },
      id,
      true,
    );
    // No metadata transaction/locks span FS inspection. These observations are not atomic
    // with metadata or with a hostile same-UID process. Every authority/asset basis is checked again.
    const sources = [];
    for (const { asset, source, refresh } of captured.sources) {
      sources.push({
        kind: 'source',
        id: asset.id,
        title: asset.title,
        ...(await inspectHandoverCustody(source, captured.metadata, refresh)),
      });
    }
    return this.read(
      actor,
      epoch,
      async (manager, scope) => {
        const row = await this.acceptedOwner(manager, scope, id, actor);
        if (
          row.version !== captured.row.version ||
          row.reviewBasis !== captured.row.reviewBasis ||
          row.manifestJson !== captured.row.manifestJson
        )
          throw new ConflictException('인계 의향 기준이 변경됐습니다.');
        return {
          requestId: row.requestId,
          organizationId: row.organizationId,
          ownerId: row.ownerId,
          recipientId: row.recipientId,
          proposalVersion: row.version,
          checkedAt: new Date().toISOString(),
          scope: 'selected_file_custody_v1',
          executionAvailable: false,
          sources,
        };
      },
      id,
      true,
    );
  }
  private assets(value: unknown): Asset[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 20)
      throw new BadRequestException('자료는 1~20개 선택해 주세요.');
    const assets = value
      .map(asset => {
        this.keys(asset, ['kind', 'id', 'title']);
        if (typeof asset.title !== 'string' || asset.title.length > 300)
          throw new BadRequestException('확인한 자료 제목을 입력해 주세요.');
        if (!['source', 'dashboard'].includes(asset.kind))
          throw new BadRequestException('자료 유형을 확인해 주세요.');
        return { kind: asset.kind, id: this.id(asset.id), title: asset.title } as Asset;
      })
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.id - b.id);
    if (new Set(assets.map(a => `${a.kind}:${a.id}`)).size !== assets.length)
      throw new BadRequestException('중복 자료는 선택할 수 없습니다.');
    return assets;
  }
  private async manifest(
    manager: EntityManager,
    owner: number,
    assets: Asset[],
    readOnly = false,
  ): Promise<Manifest[]> {
    // Existing writer order: all selected Dashboard parents, then ALL Source parents,
    // then children. No unrelated dependencies or private file bytes are inspected.
    if (!readOnly) {
      for (const id of assets
        .filter(a => a.kind === 'dashboard')
        .map(a => a.id)
        .sort((a, b) => a - b))
        await lockDashboardWrite(manager, id);
      await lockMetricSources(
        manager,
        assets.filter(a => a.kind === 'source').map(a => a.id),
      );
    }
    const result: Manifest[] = [];
    for (const asset of assets) {
      if (asset.kind === 'source') {
        const source = await manager.findOne(Database, {
          where: { id: asset.id },
          ...(readOnly ? {} : this.lock(manager)),
        });
        if (!source || source.ownerId !== owner || !source.catalogActive)
          throw new ConflictException('선택 소스의 소유·활성 상태가 변경됐습니다.');
        const metrics = await manager
          .createQueryBuilder(Metric, 'metric')
          .where('metric.databaseId = :id', { id: asset.id })
          .orderBy('metric.id', 'ASC');
        if (!readOnly && this.lock(manager).lock) metrics.setLock('pessimistic_write');
        if (source.name.slice(0, 300) !== asset.title)
          throw new ConflictException('확인한 자료 제목이 변경됐습니다.');
        result.push({
          ...asset,
          title: source.name.slice(0, 300),
          fingerprint: hash({ source, metrics: await metrics.getMany() }),
        });
      } else {
        const dashboard = await manager.findOne(Dashboard, {
          where: { id: asset.id },
          ...(readOnly ? {} : this.lock(manager)),
        });
        const mappings = manager
          .createQueryBuilder(UserMapping, 'mapping')
          .where('mapping.dashboardId = :id', { id: asset.id })
          .orderBy('mapping.id', 'ASC');
        if (!readOnly && this.lock(manager).lock) mappings.setLock('pessimistic_write');
        const owners = await mappings.getMany();
        if (
          !dashboard?.assetActive ||
          dashboard.delYn !== 'N' ||
          owners.length !== 1 ||
          owners[0].userInfoId !== owner
        )
          throw new ConflictException('선택 대시보드의 소유·활성 상태가 변경됐습니다.');
        const studio = await manager.findOne(StudioState, {
          where: { dashboardId: asset.id },
          ...(readOnly ? {} : this.lock(manager)),
        });
        if (dashboard.title.slice(0, 300) !== asset.title)
          throw new ConflictException('확인한 자료 제목이 변경됐습니다.');
        result.push({
          ...asset,
          title: dashboard.title.slice(0, 300),
          fingerprint: hash({ dashboard, mappings: owners, studio }),
        });
      }
    }
    return result;
  }
  private async pair(manager: EntityManager, owner: number, recipient: number, org: number) {
    const ownerUser = await manager.findOne(User, {
      where: { id: owner },
      select: { id: true, active: true, authVersion: true },
    });
    const receiver = await manager.findOne(User, {
      where: { id: recipient },
      select: { id: true, active: true, authVersion: true },
    });
    const ownerMember = await manager.findOneBy(EnterpriseMembership, { userId: owner });
    const recipientMember = await manager.findOneBy(EnterpriseMembership, { userId: recipient });
    if (
      owner === recipient ||
      !ownerUser?.active ||
      !receiver?.active ||
      ownerMember?.organizationId !== org ||
      recipientMember?.organizationId !== org
    )
      throw new ForbiddenException('같은 조직의 다른 활성 직원만 인계 의향을 확인할 수 있습니다.');
    return { ownerEpoch: ownerUser.authVersion ?? 0, recipientEpoch: receiver.authVersion ?? 0 };
  }
  /** Internal enterprise workflow boundary; not an HTTP API. */
  async issued(
    manager: EntityManager,
    row: EnterpriseHandoverProposal,
    organization: EnterpriseOrganization,
    readOnly = false,
  ) {
    const pair = await this.pair(manager, row.ownerId, row.recipientId, row.organizationId);
    if (
      pair.ownerEpoch !== row.ownerAuthVersion ||
      pair.recipientEpoch !== row.recipientAuthVersion ||
      organization.version !== row.organizationVersion
    )
      throw new ConflictException(
        '발급 당시 계정·조직 기준이 변경됐습니다. 새 요청을 검토해 주세요.',
      );
    const manifest = await this.manifest(
      manager,
      row.ownerId,
      JSON.parse(row.manifestJson),
      readOnly,
    );
    if (hash(manifest) !== hash(JSON.parse(row.manifestJson)))
      throw new ConflictException('선택 자료가 변경됐습니다. 새 요청을 검토해 주세요.');
  }
  private async audit(
    manager: EntityManager,
    row: EnterpriseHandoverProposal,
    actor: number,
    action: string,
  ) {
    // Exact event IDs are retained on the proposal; numeric resourceId remains its owner scope.
    const inserted = await manager.insert(EnterpriseAuditEvent, {
      organizationId: row.organizationId,
      actorId: actor,
      subjectId: row.recipientId,
      resourceId: row.ownerId,
      version: row.version,
      action: `handover.${action}`,
    });
    return this.id(inserted.identifiers[0]?.id);
  }
  async create(actor: number, epoch: number, body: unknown) {
    this.id(actor);
    this.keys(body, ['requestId', 'recipientId', 'assets']);
    const input = body as any,
      requestId = this.uuid(input.requestId),
      recipientId = this.id(input.recipientId),
      assets = this.assets(input.assets);
    const payloadHash = hash({ recipientId, assets });
    return this.write(async manager => {
      await lockStaffWrite(manager, [actor, recipientId]);
      const scope = await this.context(manager, actor, epoch);
      const existing = await manager.findOne(EnterpriseHandoverProposal, {
        where: { requestId },
        ...this.lock(manager),
      });
      if (existing && (existing.ownerId !== actor || existing.payloadHash !== payloadHash))
        throw new ConflictException('같은 UUID의 다른 요청입니다.');
      const organization = await manager.findOne(EnterpriseOrganization, {
        where: { id: Number(scope.organizationId) },
        ...this.lock(manager),
      });
      if (!organization) throw new ForbiddenException('현재 조직을 확인해 주세요.');
      if (existing) {
        this.access(existing, actor, scope);
        return this.project(manager, existing);
      }
      const pair = await this.pair(manager, actor, recipientId, organization.id);
      const row = manager.create(EnterpriseHandoverProposal, {
        requestId,
        organizationId: organization.id,
        ownerId: actor,
        recipientId,
        ownerAuthVersion: pair.ownerEpoch,
        recipientAuthVersion: pair.recipientEpoch,
        organizationVersion: organization.version,
        version: 1,
        status: 'pending',
        expiresAt: new Date(Math.floor(Date.now() / 1000) * 1000 + 24 * 60 * 60 * 1000),
        acceptedAt: null,
        acceptedAuditId: null,
        cancelledAuditId: null,
        manifestJson: JSON.stringify(await this.manifest(manager, actor, assets)),
        payloadHash,
        reviewBasis: randomBytes(32).toString('hex'),
      });
      row.createdAuditId = await this.audit(manager, row, actor, 'created');
      await manager.insert(EnterpriseHandoverProposal, row);
      return this.project(manager, row);
    });
  }
  private async change(
    requestId: unknown,
    actor: number,
    epoch: number,
    body: unknown,
    action: 'accept' | 'cancel',
  ) {
    const id = this.uuid(requestId);
    this.id(actor);
    this.keys(body, ['expectedVersion', 'reviewBasis']);
    const input = body as any,
      expected = this.id(input.expectedVersion);
    if (typeof input.reviewBasis !== 'string' || !/^[a-f0-9]{64}$/.test(input.reviewBasis))
      throw new BadRequestException('검토 기준을 확인해 주세요.');
    return serializeMetadataWork(this.db, async () => {
      // Immutable identities are read only to establish the shared User/Membership lock order.
      const hint = await this.db.manager.findOneBy(EnterpriseHandoverProposal, { requestId: id });
      return this.write(async manager => {
        await lockStaffWrite(manager, hint ? [actor, hint.ownerId, hint.recipientId] : [actor]);
        const scope = await this.context(manager, actor, epoch);
        const row = await manager.findOne(EnterpriseHandoverProposal, {
          where: { requestId: id },
          ...this.lock(manager),
        });
        this.access(row, actor, scope);
        if (actor !== (action === 'accept' ? row.recipientId : row.ownerId))
          throw new ForbiddenException('지정된 직원만 처리할 수 있습니다.');
        const organization = await manager.findOne(EnterpriseOrganization, {
          where: { id: row.organizationId },
          ...this.lock(manager),
        });
        if (!organization) throw new ForbiddenException('현재 조직을 확인해 주세요.');
        if (row.reviewBasis !== input.reviewBasis)
          throw new ConflictException('검토 기준이 변경됐습니다.');
        const status = action === 'accept' ? 'accepted' : 'cancelled';
        // A response-loss retry acknowledges historical consent even after cancellation,
        // expiry or metadata edits. It never reactivates a proposal or checks new consent.
        if (action === 'accept' && expected === 1 && row.acceptedAt !== null)
          return this.project(manager, row);
        if (action === 'cancel' && row.status === 'cancelled' && row.version === expected + 1)
          return this.project(manager, row);
        if (action === 'accept') await this.issued(manager, row, organization);
        if (
          row.version !== expected ||
          row.status === 'cancelled' ||
          (action === 'accept' &&
            (row.status !== 'pending' || row.expiresAt.getTime() <= Date.now()))
        )
          throw new ConflictException('요청 상태·버전·만료를 다시 확인해 주세요.');
        const acceptedAt =
          action === 'accept' ? new Date(Math.floor(Date.now() / 1000) * 1000) : row.acceptedAt;
        const auditId = await this.audit(
          manager,
          { ...row, version: expected + 1 },
          actor,
          action === 'accept' ? 'accepted' : 'cancelled',
        );
        const auditLink =
          action === 'accept' ? { acceptedAuditId: auditId } : { cancelledAuditId: auditId };
        const updated = await manager.update(
          EnterpriseHandoverProposal,
          { requestId: id, version: expected, status: row.status, reviewBasis: input.reviewBasis },
          {
            status,
            version: expected + 1,
            ...auditLink,
            ...(action === 'accept' ? { acceptedAt } : {}),
          },
        );
        if (updated.affected !== 1) throw new ConflictException('요청이 변경됐습니다.');
        row.status = status;
        row.version = expected + 1;
        if (action === 'accept') row.acceptedAt = acceptedAt;
        Object.assign(row, auditLink);
        return this.project(manager, row);
      });
    });
  }
  accept(requestId: unknown, actor: number, epoch: number, body: unknown) {
    return this.change(requestId, actor, epoch, body, 'accept');
  }
  cancel(requestId: unknown, actor: number, epoch: number, body: unknown) {
    return this.change(requestId, actor, epoch, body, 'cancel');
  }
}
