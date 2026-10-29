import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { groupKeys, groupWrite } from './group.service';
import { serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseStaffTransfer } from './entities/enterprise-staff-transfer.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupMember,
  EnterpriseGroupGrant,
} from './entities/enterprise-group.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { revokeReportDeliveriesForTransfer } from '../reports/report-delivery-transfer';

@Injectable()
export class StaffTransferService {
  constructor(private readonly db: DataSource) {}
  private id(n: unknown) {
    if (!Number.isSafeInteger(n) || Number(n) < 1 || Number(n) >= 2147483647)
      throw new BadRequestException('조직 번호·버전을 확인해 주세요.');
    return Number(n);
  }
  private hash(code: unknown) {
    if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code))
      throw new BadRequestException('15분 이동 코드를 확인해 주세요.');
    return createHash('sha256').update(code).digest('hex');
  }
  private lock(manager: EntityManager) {
    return ['mysql', 'mariadb'].includes(manager.connection.options.type)
      ? { lock: { mode: 'pessimistic_write' as const } }
      : {};
  }
  private async account(manager: EntityManager, actor: number, epoch: number, own = true) {
    const user = await manager.findOne(User, {
      where: { id: this.id(actor) },
      ...this.lock(manager),
    });
    if (!user?.active || !Number.isSafeInteger(epoch) || (user.authVersion ?? 0) !== epoch) {
      if (own) throw new UnauthorizedException('로그인이 변경되었습니다. 다시 로그인해 주세요.');
      throw new ConflictException(
        '직원 또는 수락 관리자의 계정이 변경됐습니다. 요청을 다시 확인해 주세요.',
      );
    }
    return user;
  }
  private async member(manager: EntityManager, userId: number, org?: number, admin = false) {
    const row = await manager.findOne(EnterpriseMembership, {
      where: { userId },
      ...this.lock(manager),
    });
    if (
      !row ||
      (org !== undefined && row.organizationId !== org) ||
      (admin && row.role !== 'admin')
    )
      throw new ForbiddenException('현재 조직 권한을 확인해 주세요.');
    return row;
  }
  private basis(row: EnterpriseStaffTransfer) {
    return createHash('sha256')
      .update(
        JSON.stringify([
          row.codeHash,
          row.userId,
          row.sourceOrganizationId,
          row.targetOrganizationId,
          row.authVersion,
          row.expiresAt.toISOString(),
          row.acceptedBy,
          row.acceptedEpoch,
          row.targetVersion,
          row.team,
        ]),
      )
      .digest('hex');
  }
  private view(row: EnterpriseStaffTransfer) {
    return {
      sourceOrganizationId: row.sourceOrganizationId,
      targetOrganizationId: row.targetOrganizationId,
      team: row.team,
      accepted: row.acceptedBy !== null,
      expiresAt: row.expiresAt.toISOString(),
      status: row.completed ? 'completed' : 'pending',
    };
  }
  async status(actor: number, epoch: number) {
    return serializeMetadataWork(this.db, async () => {
      const user = await this.db.manager.findOneBy(User, { id: actor });
      if (!user?.active || (user.authVersion ?? 0) !== epoch) throw new UnauthorizedException();
      const row = await this.db.manager.findOneBy(EnterpriseStaffTransfer, { userId: actor });
      return row ? this.view(row) : null;
    });
  }
  async request(actor: number, epoch: number, body: unknown) {
    groupKeys(body, ['targetOrganizationId']);
    const targetOrganizationId = this.id((body as any).targetOrganizationId);
    return groupWrite(this.db, async manager => {
      const user = await this.account(manager, actor, epoch);
      const member = await this.member(manager, actor);
      if (
        member.organizationId === targetOrganizationId ||
        !(await manager.findOneBy(EnterpriseOrganization, { id: targetOrganizationId }))
      )
        throw new BadRequestException('다른 대상 조직 번호를 확인해 주세요.');
      const code = randomBytes(32).toString('hex'),
        expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await manager.save(EnterpriseStaffTransfer, {
        userId: actor,
        sourceOrganizationId: member.organizationId,
        targetOrganizationId,
        authVersion: user.authVersion ?? 0,
        codeHash: this.hash(code),
        expiresAt,
        acceptedBy: null,
        acceptedEpoch: null,
        targetVersion: null,
        team: '',
        completed: false,
      });
      return {
        code,
        expiresAt: expiresAt.toISOString(),
        sourceOrganizationId: member.organizationId,
        targetOrganizationId,
      };
    });
  }
  async revoke(actor: number, epoch: number) {
    return groupWrite(this.db, async manager => {
      await this.account(manager, actor, epoch);
      await manager.delete(EnterpriseStaffTransfer, { userId: actor, completed: false });
      return { revoked: true };
    });
  }
  private async pending(manager: EntityManager, hash: string) {
    const row = await manager.findOne(EnterpriseStaffTransfer, {
      where: { codeHash: hash },
      ...this.lock(manager),
    });
    if (!row || row.completed || row.expiresAt.getTime() <= Date.now())
      throw new ConflictException(
        '이동 요청이 만료되었거나 처리됐습니다. 현재 소속을 확인해 주세요.',
      );
    return row;
  }
  private async organization(
    manager: EntityManager,
    id: number,
    expected: number,
    increment = false,
  ) {
    const row = await manager.findOne(EnterpriseOrganization, {
      where: { id },
      ...this.lock(manager),
    });
    if (!row || row.version !== expected)
      throw new ConflictException('조직 정보가 변경됐습니다. 양쪽 최신 버전을 확인해 주세요.');
    if (increment)
      await manager.update(
        EnterpriseOrganization,
        { id, version: expected },
        { version: expected + 1 },
      );
    return row;
  }
  async review(actor: number, epoch: number, body: unknown) {
    groupKeys(body, ['code']);
    const hash = this.hash((body as any).code);
    return groupWrite(this.db, async manager => {
      const row = await this.pending(manager, hash);
      await this.account(manager, actor, epoch);
      const admin = await this.member(manager, actor, undefined, true);
      if (![row.sourceOrganizationId, row.targetOrganizationId].includes(admin.organizationId))
        throw new ForbiddenException('현재 조직의 이동 요청만 확인할 수 있습니다.');
      await this.member(manager, row.userId, row.sourceOrganizationId);
      const source = await manager.findOneByOrFail(EnterpriseOrganization, {
        id: row.sourceOrganizationId,
      });
      const target = await manager.findOneByOrFail(EnterpriseOrganization, {
        id: row.targetOrganizationId,
      });
      return {
        ...this.view(row),
        userId: row.userId,
        sourceVersion: source.version,
        targetVersion: target.version,
        reviewBasis: this.basis(row),
      };
    });
  }
  async accept(actor: number, epoch: number, body: unknown) {
    groupKeys(body, ['code', 'team', 'expectedVersion']);
    const input = body as any,
      hash = this.hash(input.code),
      version = this.id(input.expectedVersion);
    if (typeof input.team !== 'string' || input.team.length > 100)
      throw new BadRequestException('팀 이름은100자 이내입니다.');
    return groupWrite(this.db, async manager => {
      const row = await this.pending(manager, hash);
      for (const id of [...new Set([actor, row.userId])].sort((a, b) => a - b))
        await this.account(manager, id, id === actor ? epoch : row.authVersion, id === actor);
      if (actor === row.userId)
        throw new ForbiddenException('대상 조직의 다른 관리자 확인이 필요합니다.');
      await this.member(manager, actor, row.targetOrganizationId, true);
      await this.member(manager, row.userId, row.sourceOrganizationId);
      await this.organization(manager, row.targetOrganizationId, version);
      await manager.update(
        EnterpriseStaffTransfer,
        { userId: row.userId, codeHash: hash },
        {
          acceptedBy: actor,
          acceptedEpoch: epoch,
          targetVersion: version,
          team: input.team.trim(),
        },
      );
      if (
        row.acceptedBy !== actor ||
        row.acceptedEpoch !== epoch ||
        row.targetVersion !== version ||
        row.team !== input.team.trim()
      )
        await manager.insert(EnterpriseAuditEvent, {
          organizationId: row.targetOrganizationId,
          actorId: actor,
          action: 'member.transfer.accepted',
          subjectId: row.userId,
          resourceId: row.userId,
          version,
        });
      return {
        accepted: true,
        sourceOrganizationId: row.sourceOrganizationId,
        targetOrganizationId: row.targetOrganizationId,
        team: input.team.trim(),
        expiresAt: row.expiresAt.toISOString(),
      };
    });
  }
  async complete(actor: number, epoch: number, body: unknown) {
    groupKeys(body, ['code', 'expectedVersion', 'targetExpectedVersion', 'reviewBasis']);
    const input = body as any,
      hash = this.hash(input.code),
      sourceVersion = this.id(input.expectedVersion),
      targetVersion = this.id(input.targetExpectedVersion);
    return groupWrite(this.db, async manager => {
      const row = await this.pending(manager, hash);
      if (typeof input.reviewBasis !== 'string' || input.reviewBasis !== this.basis(row))
        throw new ConflictException('수락 내용이 변경됐습니다. 이동 요청을 다시 검토해 주세요.');
      if (!row.acceptedBy || row.acceptedEpoch === null || row.targetVersion !== targetVersion)
        throw new ConflictException('대상 조직 관리자의 최신 수락이 필요합니다.');
      if (actor === row.userId)
        throw new ForbiddenException('현재 조직의 다른 관리자 확인이 필요합니다.');
      if (
        !Number.isSafeInteger(row.authVersion) ||
        row.authVersion < 0 ||
        row.authVersion >= 2147483647
      )
        throw new ConflictException('계정 버전 한도를 확인해 주세요.');
      const epochs = new Map([
        [row.userId, row.authVersion],
        [row.acceptedBy, row.acceptedEpoch],
        [actor, epoch],
      ]);
      for (const id of [...epochs.keys()].sort((a, b) => a - b))
        await this.account(manager, id, epochs.get(id), id === actor);
      await this.member(manager, actor, row.sourceOrganizationId, true);
      await this.member(manager, row.acceptedBy, row.targetOrganizationId, true);
      await this.member(manager, row.userId, row.sourceOrganizationId);
      for (const id of [row.sourceOrganizationId, row.targetOrganizationId].sort((a, b) => a - b))
        await this.organization(
          manager,
          id,
          id === row.sourceOrganizationId ? sourceVersion : targetVersion,
          true,
        );
      await revokeReportDeliveriesForTransfer(manager, row.userId);
      for (const [entity, predicate] of [
        [EnterpriseResourceGrant, '(r.recipientId = :user OR r.ownerId = :user)'],
        [EnterpriseDashboardDelivery, '(r.recipientId = :user OR r.ownerId = :user)'],
        [EnterpriseGroupGrant, 'r.ownerId = :user'],
        [EnterpriseGroupDelivery, 'r.ownerId = :user'],
      ] as const) {
        const invalid = await manager
          .createQueryBuilder(entity, 'r')
          .where(predicate, { user: row.userId })
          .andWhere('(r.version < 0 OR r.version >= :max)', { max: 2147483647 })
          .getCount();
        if (invalid) throw new ConflictException('관계 버전 한도를 확인해 주세요.');
      }
      // UC051: revoke relationships, never delete assets or silently move ownership.
      await manager
        .createQueryBuilder()
        .update(EnterpriseResourceGrant)
        .set({
          read: false,
          edit: false,
          publish: false,
          export: false,
          version: () => 'version + 1',
        })
        .where('(recipientId = :user OR ownerId = :user)', { user: row.userId })
        .execute();
      await manager
        .createQueryBuilder()
        .update(EnterpriseDashboardDelivery)
        .set({ active: false, allowCopy: false, version: () => 'version + 1' })
        .where('(recipientId = :user OR ownerId = :user)', { user: row.userId })
        .execute();
      await manager
        .createQueryBuilder()
        .update(EnterpriseGroupGrant)
        .set({
          read: false,
          edit: false,
          publish: false,
          export: false,
          version: () => 'version + 1',
        })
        .where('ownerId = :user', { user: row.userId })
        .execute();
      await manager
        .createQueryBuilder()
        .update(EnterpriseGroupDelivery)
        .set({ active: false, allowCopy: false, version: () => 'version + 1' })
        .where('ownerId = :user', { user: row.userId })
        .execute();
      const joins = await manager.find(EnterpriseGroupMember, { where: { userId: row.userId } });
      if (joins.length) {
        const ids = joins.map(g => g.groupId).sort((a, b) => a - b);
        for (const id of ids) {
          const group = await manager.findOne(EnterpriseGroup, {
            where: { id },
            ...this.lock(manager),
          });
          if (group) {
            if (
              !Number.isSafeInteger(group.version) ||
              group.version < 1 ||
              group.version >= 2147483647
            )
              throw new ConflictException('그룹 버전 한도를 확인해 주세요.');
            await manager.increment(EnterpriseGroup, { id }, 'version', 1);
          }
        }
        await manager.delete(EnterpriseGroupMember, { userId: row.userId, groupId: In(ids) });
      }
      await manager.delete(EnterpriseEnrollment, { userId: row.userId });
      await manager.update(
        EnterpriseMembership,
        { userId: row.userId, organizationId: row.sourceOrganizationId },
        { organizationId: row.targetOrganizationId, role: 'member', team: row.team },
      );
      await manager.update(
        User,
        { id: row.userId },
        { authVersion: row.authVersion + 1, jwtId: null },
      );
      await manager.update(
        EnterpriseStaffTransfer,
        { userId: row.userId, codeHash: hash },
        { completed: true },
      );
      for (const organizationId of [row.sourceOrganizationId, row.targetOrganizationId])
        await manager.insert(EnterpriseAuditEvent, {
          organizationId,
          actorId: actor,
          action: 'member.transferred',
          subjectId: row.userId,
          resourceId: row.userId,
          version:
            (organizationId === row.sourceOrganizationId ? sourceVersion : targetVersion) + 1,
        });
      return {
        completed: true,
        sourceOrganizationId: row.sourceOrganizationId,
        targetOrganizationId: row.targetOrganizationId,
        userId: row.userId,
      };
    });
  }
}
