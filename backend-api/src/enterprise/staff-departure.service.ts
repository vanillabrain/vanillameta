import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseGroup, EnterpriseGroupMember } from './entities/enterprise-group.entity';
import { EnterpriseStaffDeparture } from './entities/enterprise-staff-departure.entity';
import { lockStaffWrite } from './staff-write-lock';
import { departureHash, departureRelations, inspectStaffDeparture } from './staff-departure-basis';

@Injectable()
export class StaffDepartureService {
  constructor(private readonly db: DataSource) {}
  private uuid(value: unknown) {
    if (
      typeof value !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
    )
      throw new BadRequestException('요청 UUID를 확인해 주세요.');
    return value;
  }
  private input(body: any, action: 'request' | 'complete' | 'cancel') {
    const keys =
      action === 'request'
        ? ['requestId', 'expectedOrganizationVersion', 'acknowledgedDeparture']
        : action === 'complete'
        ? ['expectedVersion', 'reviewBasis', 'acknowledgedDeparture']
        : ['expectedVersion', 'acknowledgedDeparture'];
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== keys.length ||
      Object.keys(body).some(k => !keys.includes(k)) ||
      body.acknowledgedDeparture !== true
    )
      throw new BadRequestException('탈퇴 항목과 별도 동의를 확인해 주세요.');
    const version = body[action === 'request' ? 'expectedOrganizationVersion' : 'expectedVersion'];
    if (!Number.isSafeInteger(version) || version < 1 || version >= 2147483647)
      throw new BadRequestException('현재 버전을 확인해 주세요.');
    if (action === 'request') this.uuid(body.requestId);
    if (
      action === 'complete' &&
      (typeof body.reviewBasis !== 'string' || !/^[a-f0-9]{64}$/.test(body.reviewBasis))
    )
      throw new BadRequestException('검토 기준을 확인해 주세요.');
    return body;
  }
  private lock(manager: EntityManager) {
    return ['mysql', 'mariadb'].includes(manager.connection.options.type)
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {};
  }
  private async account(manager: EntityManager, actor: number, epoch: number) {
    const user = await manager.findOneBy(User, { id: actor });
    if (
      !user?.active ||
      !Number.isSafeInteger(epoch) ||
      epoch < 0 ||
      (user.authVersion ?? 0) !== epoch
    )
      throw new UnauthorizedException('로그인이 변경되었습니다. 다시 로그인해 주세요.');
    return user;
  }
  private async row(manager: EntityManager, id: string, locked = false) {
    const row = await manager.findOne(EnterpriseStaffDeparture, {
      where: { requestId: id },
      ...(locked ? this.lock(manager) : {}),
    });
    if (!row) throw new NotFoundException('탈퇴 요청을 찾을 수 없습니다.');
    return row;
  }
  private async access(
    manager: EntityManager,
    row: EnterpriseStaffDeparture,
    actor: number,
    epoch: number,
    admin = false,
  ) {
    await this.account(manager, actor, epoch);
    const member = await manager.findOneBy(EnterpriseMembership, { userId: actor });
    if (admin || actor !== row.userId) {
      if (
        actor === row.userId ||
        member?.organizationId !== row.organizationId ||
        member.role !== 'admin'
      )
        throw new ForbiddenException('원 조직의 다른 현재 관리자만 확인할 수 있습니다.');
    }
  }
  private view(row: EnterpriseStaffDeparture, replayed = false) {
    return {
      requestId: row.requestId,
      userId: row.userId,
      organizationId: row.organizationId,
      version: row.version,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      completedBy: row.completedBy,
      completeOrganizationVersion: row.completeOrganizationVersion,
      replayed,
    };
  }
  private async current(
    manager: EntityManager,
    row: EnterpriseStaffDeparture,
    actor: number,
    epoch: number,
  ) {
    await this.access(manager, row, actor, epoch, true);
    const user = await manager.findOneBy(User, { id: row.userId });
    const member = await manager.findOneBy(EnterpriseMembership, { userId: row.userId });
    const org = await manager.findOneBy(EnterpriseOrganization, { id: row.organizationId });
    if (
      row.status !== 'requested' ||
      row.version !== 1 ||
      row.expiresAt.getTime() <= Date.now() ||
      !user?.active ||
      user.authVersion !== row.authVersion ||
      member?.organizationId !== row.organizationId ||
      !org ||
      org.version !== row.organizationVersion
    )
      throw new ConflictException('탈퇴 의향 또는 현재 조직 기준이 변경됐습니다.');
    const basis = await inspectStaffDeparture(manager, row.userId, row.organizationId);
    if (
      !Number.isSafeInteger(user.authVersion) ||
      user.authVersion < 0 ||
      user.authVersion >= 2147483647 ||
      !Number.isSafeInteger(org.version) ||
      org.version >= 2147483647
    )
      basis.blockers.push('unsupported_state');
    const reviewBasis = this.opaque(
      row.requestId,
      departureHash({ row, actor, epoch, member, org, hash: basis.hash }),
    );
    return { ...basis, reviewBasis, org, user };
  }
  private opaque(id: string, hash: string) {
    if (!process.env.ACCESS_SECRET) throw new Error('Departure basis secret is not configured');
    return createHmac('sha256', process.env.ACCESS_SECRET)
      .update(`staff-departure-v1:${id}:${hash}`)
      .digest('hex');
  }
  private async write<T>(run: (manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      return this.db.options.type === 'mysql' || this.db.options.type === 'mariadb'
        ? await metadataTransaction(this.db, 'READ COMMITTED', run)
        : await metadataTransaction(this.db, run);
    } catch (e) {
      if (
        e instanceof QueryFailedError &&
        [
          'ER_DUP_ENTRY',
          'ER_LOCK_DEADLOCK',
          'ER_LOCK_WAIT_TIMEOUT',
          'SQLITE_BUSY',
          'SQLITE_LOCKED',
        ].includes((e.driverError as any)?.code)
      )
        throw new ConflictException('탈퇴 요청이 경합 중입니다. 현재 상태를 확인해 주세요.');
      throw e;
    }
  }
  private async audit(
    manager: EntityManager,
    row: EnterpriseStaffDeparture,
    actor: number,
    action: string,
    version: number,
  ) {
    const event = await manager.save(EnterpriseAuditEvent, {
      organizationId: row.organizationId,
      actorId: actor,
      subjectId: row.userId,
      resourceId: row.userId,
      action,
      version,
    });
    return event.id;
  }
  async request(actor: number, epoch: number, raw: unknown) {
    const body = this.input(raw, 'request'),
      payloadHash = departureHash(body);
    return this.write(async manager => {
      await lockStaffWrite(manager, [actor]);
      const user = await this.account(manager, actor, epoch);
      const prior = await manager.findOne(EnterpriseStaffDeparture, {
        where: { requestId: body.requestId },
        ...this.lock(manager),
      });
      if (prior) {
        if (prior.userId !== actor) throw new ForbiddenException();
        if (prior.payloadHash !== payloadHash)
          throw new ConflictException('같은 UUID의 입력이 다릅니다.');
        return this.view(prior, true);
      }
      const member = await manager.findOneBy(EnterpriseMembership, { userId: actor });
      if (!member) throw new ForbiddenException('현재 조직 소속이 필요합니다.');
      const org = await manager.findOne(EnterpriseOrganization, {
        where: { id: member.organizationId },
        ...this.lock(manager),
      });
      if (!org || org.version !== body.expectedOrganizationVersion)
        throw new ConflictException('조직 버전이 변경됐습니다.');
      const pending = await manager.find(EnterpriseStaffDeparture, {
        where: { userId: actor, status: 'requested' },
      });
      if (pending.some(r => r.expiresAt.getTime() > Date.now()))
        throw new ConflictException('미완료 탈퇴 요청이 있습니다.');
      const now = new Date();
      const row = manager.create(EnterpriseStaffDeparture, {
        requestId: body.requestId,
        userId: actor,
        organizationId: org.id,
        authVersion: user.authVersion ?? 0,
        organizationVersion: org.version,
        version: 1,
        status: 'requested',
        requestedAt: now,
        expiresAt: new Date(now.getTime() + 900000),
        completedAt: null,
        cancelledAt: null,
        completedBy: null,
        completeOrganizationVersion: null,
        payloadHash,
        completePayloadHash: null,
        completedAuditId: null,
        cancelledAuditId: null,
      });
      row.requestedAuditId = await this.audit(manager, row, actor, 'member.departure.requested', 1);
      await manager.insert(EnterpriseStaffDeparture, row);
      return this.view(row);
    });
  }
  /** Fresh linearization query outside the read snapshot includes auth, membership, org and request. */
  private fresh(manager: EntityManager, id: string, actor: number) {
    return manager
      .createQueryBuilder(User, 'u')
      .leftJoin(EnterpriseMembership, 'm', 'm.userId = u.id')
      .leftJoin(EnterpriseStaffDeparture, 'r', 'r.requestId = :id', { id })
      .leftJoin(User, 'target', 'target.id = r.userId')
      .leftJoin(EnterpriseMembership, 'tm', 'tm.userId = r.userId')
      .leftJoin(EnterpriseOrganization, 'o', 'o.id = r.organizationId')
      .select('u.id', 'actorId')
      .addSelect('u.active', 'actorActive')
      .addSelect('u.authVersion', 'actorEpoch')
      .addSelect('m.organizationId', 'actorOrg')
      .addSelect('m.role', 'actorRole')
      .addSelect('m.team', 'actorTeam')
      .addSelect('r.userId', 'userId')
      .addSelect('r.organizationId', 'organizationId')
      .addSelect('r.version', 'version')
      .addSelect('r.status', 'status')
      .addSelect('r.expiresAt', 'expiresAt')
      .addSelect('target.active', 'targetActive')
      .addSelect('target.authVersion', 'targetEpoch')
      .addSelect('tm.organizationId', 'targetOrg')
      .addSelect('tm.role', 'targetRole')
      .addSelect('tm.team', 'targetTeam')
      .addSelect('o.version', 'organizationVersion')
      .where('u.id = :actor', { actor })
      .getRawOne();
  }
  private read<T>(
    actor: number,
    epoch: number,
    id: string,
    review: boolean,
    run: (manager: EntityManager, row: EnterpriseStaffDeparture) => Promise<T>,
  ) {
    this.uuid(id);
    return serializeMetadataWork(this.db, async () => {
      const snapshot = async (manager: EntityManager) => {
        await this.account(manager, actor, epoch);
        const row = await this.row(manager, id);
        await this.access(manager, row, actor, epoch, review);
        return {
          authority: await this.fresh(manager, id, actor),
          expiresAt: row.expiresAt.getTime(),
          result: await run(manager, row),
        };
      };
      const old = ['mysql', 'mariadb'].includes(this.db.options.type)
        ? await this.db.transaction('REPEATABLE READ', snapshot)
        : await this.db.transaction(snapshot);
      const fresh = await this.fresh(this.db.manager, id, actor);
      if (!fresh || !Number(fresh.actorActive) || Number(fresh.actorEpoch) !== epoch)
        throw new UnauthorizedException();
      if (
        (review || Number(fresh.userId) !== actor) &&
        (Number(fresh.actorOrg) !== Number(fresh.organizationId) ||
          fresh.actorRole !== 'admin' ||
          Number(fresh.userId) === actor)
      )
        throw new ForbiddenException();
      if (
        departureHash(old.authority) !== departureHash(fresh) ||
        (review && old.expiresAt <= Date.now())
      )
        throw new ConflictException('신원 또는 탈퇴 기준이 변경됐습니다. 다시 확인해 주세요.');
      return old.result;
    });
  }
  get(actor: number, epoch: number, id: string) {
    return this.read(actor, epoch, id, false, async (_manager, row) => this.view(row));
  }
  review(actor: number, epoch: number, id: string) {
    return this.read(actor, epoch, id, true, async (manager, row) => {
      const state = await this.current(manager, row, actor, epoch);
      return {
        requestId: id,
        userId: row.userId,
        organizationId: row.organizationId,
        requestVersion: row.version,
        organizationVersion: state.org.version,
        checkedAt: new Date().toISOString(),
        basis: state.reviewBasis,
        eligible: state.blockers.length === 0,
        blockers: [...new Set(state.blockers)].sort(),
        counts: state.counts,
      };
    });
  }
  async cancel(actor: number, epoch: number, id: string, raw: unknown) {
    this.uuid(id);
    const body = this.input(raw, 'cancel');
    return this.write(async manager => {
      await lockStaffWrite(manager, [actor]);
      await this.account(manager, actor, epoch);
      const row = await this.row(manager, id, true);
      if (row.userId !== actor) throw new ForbiddenException();
      if (row.status === 'cancelled' && body.expectedVersion === 1) return this.view(row, true);
      if (row.status !== 'requested' || row.version !== body.expectedVersion)
        throw new ConflictException('탈퇴 요청 상태가 변경됐습니다.');
      row.status = 'cancelled';
      row.version++;
      row.cancelledAt = new Date();
      row.cancelledAuditId = await this.audit(
        manager,
        row,
        actor,
        'member.departure.cancelled',
        row.version,
      );
      await manager.save(EnterpriseStaffDeparture, row);
      return this.view(row);
    });
  }
  async complete(actor: number, epoch: number, id: string, raw: unknown) {
    this.uuid(id);
    const body = this.input(raw, 'complete'),
      payloadHash = departureHash(body);
    return this.write(async manager => {
      // This discovery read establishes no authority; RC rereads after the User fence.
      const initial = await this.row(manager, id);
      await lockStaffWrite(manager, [actor, initial.userId]);
      await this.account(manager, actor, epoch);
      const row = await this.row(manager, id, true);
      await this.access(manager, row, actor, epoch, true);
      if (row.status === 'completed') {
        if (row.completedBy !== actor || row.completePayloadHash !== payloadHash)
          throw new ConflictException('원 실행 관리자와 정확한 입력으로 확인해 주세요.');
        return this.view(row, true);
      }
      await this.access(manager, row, actor, epoch, true);
      await manager.findOne(EnterpriseOrganization, {
        where: { id: row.organizationId },
        ...this.lock(manager),
      });
      const joins = await manager.find(EnterpriseGroupMember, {
        where: { userId: row.userId },
        order: { groupId: 'ASC' },
      });
      for (const join of joins)
        await manager.findOne(EnterpriseGroup, {
          where: { id: join.groupId },
          ...this.lock(manager),
        });
      const state = await this.current(manager, row, actor, epoch);
      if (
        row.version !== body.expectedVersion ||
        state.reviewBasis !== body.reviewBasis ||
        state.blockers.length ||
        row.expiresAt.getTime() <= Date.now()
      )
        throw new ConflictException('탈퇴 검토 기준 또는 기한이 변경됐습니다.');
      // No awaits that inspect authority/work remain between this deadline check and mutation.
      for (const [index, [entity]] of departureRelations.entries()) {
        for (const relation of state.relationships[index]) {
          const key = Object.fromEntries(
            manager.connection
              .getMetadata(entity)
              .primaryColumns.map(c => [c.propertyName, relation[c.propertyName]]),
          );
          const values = entity.name.endsWith('Grant')
            ? {
                read: false,
                edit: false,
                publish: false,
                export: false,
                version: relation.version + 1,
              }
            : { active: false, allowCopy: false, version: relation.version + 1 };
          const changed = await manager.update(
            entity,
            { ...key, version: relation.version },
            values,
          );
          if (changed.affected !== 1) throw new ConflictException('관계 기준이 변경됐습니다.');
        }
      }
      for (const group of state.groups) {
        const changed = await manager.update(
          EnterpriseGroup,
          { id: group.id, version: group.version },
          { version: group.version + 1 },
        );
        if (changed.affected !== 1) throw new ConflictException('그룹 기준이 변경됐습니다.');
      }
      await manager.delete(EnterpriseGroupMember, { userId: row.userId });
      await manager.delete(EnterpriseEnrollment, { userId: row.userId });
      const removed = await manager.delete(EnterpriseMembership, {
        userId: row.userId,
        organizationId: row.organizationId,
      });
      const revoked = await manager.update(
        User,
        { id: row.userId, authVersion: row.authVersion, active: true },
        { authVersion: row.authVersion + 1, jwtId: null },
      );
      const updated = await manager.update(
        EnterpriseOrganization,
        { id: row.organizationId, version: state.org.version },
        { version: state.org.version + 1 },
      );
      if (removed.affected !== 1 || revoked.affected !== 1 || updated.affected !== 1)
        throw new ConflictException('탈퇴 확정이 경합했습니다.');
      row.status = 'completed';
      row.version++;
      row.completedBy = actor;
      row.completedAt = new Date();
      row.completeOrganizationVersion = state.org.version + 1;
      row.completePayloadHash = payloadHash;
      row.completedAuditId = await this.audit(
        manager,
        row,
        actor,
        'member.departure.completed',
        row.version,
      );
      await manager.save(EnterpriseStaffDeparture, row);
      return this.view(row);
    });
  }
}
