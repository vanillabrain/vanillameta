import { serializeMetadataWork } from '../common/metadata-work';
import { serializeEnterpriseWrite } from './enterprise-write';
import { createHash, randomBytes } from 'crypto';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan, QueryFailedError } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';

@Injectable()
export class EnterpriseService {
  constructor(private readonly db: DataSource) {}
  private id(value: unknown) {
    if (!Number.isSafeInteger(value) || Number(value) <= 0)
      throw new BadRequestException('잘못된 계정 ID입니다.');
    return Number(value);
  }
  private fields(body: any, keys: string[]) {
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(key => !keys.includes(key)) ||
      keys.some(key => body[key] === undefined)
    )
      throw new BadRequestException('변경 항목을 확인해 주세요.');
    return body;
  }
  private text(value: unknown, max: number, required = false) {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
      throw new BadRequestException('이름·소속의 길이를 확인해 주세요.');
    return value.trim();
  }
  private role(value: unknown): 'admin' | 'member' {
    if (value !== 'admin' && value !== 'member')
      throw new BadRequestException('역할을 확인해 주세요.');
    return value;
  }
  private version(value: unknown) {
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) >= 2147483647)
      throw new BadRequestException('조직 버전을 확인해 주세요.');
    return Number(value);
  }
  private async user(actor: number, manager = this.db.manager, lock = false) {
    const user = await manager.findOne(User, {
      where: { id: this.id(actor) },
      ...(lock && manager.connection.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!user || user.active === false)
      throw new ForbiddenException('활성 계정만 사용할 수 있습니다.');
    return user;
  }
  private async scope(actor: number, manager = this.db.manager, requireAdmin = false) {
    await this.user(actor, manager);
    const membership = await manager.findOneBy(EnterpriseMembership, { userId: actor });
    if (!membership || (requireAdmin && membership.role !== 'admin'))
      throw new ForbiddenException('조직 관리 권한이 없습니다.');
    const organization = await manager.findOneBy(EnterpriseOrganization, {
      id: membership.organizationId,
    });
    if (!organization) throw new ForbiddenException('조직을 확인할 수 없습니다.');
    return { organization, membership };
  }
  async context(actor: number) {
    return serializeMetadataWork(this.db, async () => {
      await this.user(actor);
      if (!(await this.db.manager.findOneBy(EnterpriseMembership, { userId: actor })))
        return { organization: null, membership: null };
      const { organization, membership } = await this.scope(actor);
      return {
        organization,
        membership: { userId: membership.userId, role: membership.role, team: membership.team },
      };
    });
  }
  async enrollment(actor: number, body: unknown) {
    const input = this.fields(body, ['organizationId']);
    const organizationId = this.id(input.organizationId);
    return this.mutation(async manager => {
      await this.user(actor, manager);
      if (await manager.findOneBy(EnterpriseMembership, { userId: actor }))
        throw new ConflictException('이미 조직에 소속돼 있습니다.');
      const organization = await manager.findOneBy(EnterpriseOrganization, { id: organizationId });
      if (!organization) throw new BadRequestException('참여할 조직 번호를 확인해 주세요.');
      const enrollmentCode = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await manager.save(EnterpriseEnrollment, {
        userId: actor,
        organizationId,
        codeHash: createHash('sha256').update(enrollmentCode).digest('hex'),
        expiresAt,
      });
      return {
        enrollmentCode,
        expiresAt: expiresAt.toISOString(),
        organization: { id: organization.id, name: organization.name },
      };
    });
  }
  async revokeEnrollment(actor: number) {
    return serializeMetadataWork(this.db, async () => {
      await this.user(actor);
      await this.db.manager.delete(EnterpriseEnrollment, { userId: actor });
      return { revoked: true };
    });
  }
  private async mutation<T>(run: (manager: EntityManager) => Promise<T>) {
    const execute = async () => {
      try {
        return await this.db.transaction(run);
      } catch (error) {
        if (
          (error instanceof QueryFailedError &&
            [
              'SQLITE_BUSY',
              'SQLITE_LOCKED',
              'ER_DUP_ENTRY',
              'ER_NO_REFERENCED_ROW',
              'ER_NO_REFERENCED_ROW_2',
              'ER_LOCK_DEADLOCK',
              'ER_LOCK_WAIT_TIMEOUT',
              '40001',
              '40P01',
              '55P03',
            ].includes((error.driverError as any)?.code)) ||
          (error instanceof QueryFailedError &&
            (error.driverError as any)?.code === 'SQLITE_CONSTRAINT' &&
            /UNIQUE|PRIMARY KEY|FOREIGN KEY/i.test((error.driverError as any)?.message ?? ''))
        )
          throw new ConflictException('다른 변경이 먼저 반영됐습니다. 최신 목록을 확인해 주세요.');
        throw error;
      }
    };
    return serializeEnterpriseWrite(this.db, execute);
  }
  private async audit(
    manager: EntityManager,
    organizationId: number,
    actorId: number,
    action: string,
    resourceId: number,
    version: number,
  ) {
    await manager.insert(EnterpriseAuditEvent, {
      organizationId,
      actorId,
      action,
      resourceId,
      version,
    });
  }
  async create(actor: number, body: unknown) {
    const input = this.fields(body, ['name']);
    const name = this.text(input.name, 100, true);
    return this.mutation(async manager => {
      await this.user(actor, manager, true);
      if (await manager.findOneBy(EnterpriseMembership, { userId: actor }))
        throw new ConflictException('이미 조직에 소속돼 있습니다.');
      const organization = await manager.save(EnterpriseOrganization, { name, version: 1 });
      const membership = await manager.save(EnterpriseMembership, {
        userId: actor,
        organizationId: organization.id,
        role: 'admin' as const,
        team: '',
      });
      await this.audit(manager, organization.id, actor, 'organization.created', organization.id, 1);
      return {
        organization,
        membership: { userId: actor, role: membership.role, team: membership.team },
      };
    });
  }
  async members(actor: number, afterId?: unknown, query?: unknown) {
    return serializeMetadataWork(this.db, async () => {
      const after =
        afterId === undefined
          ? 0
          : this.id(
              typeof afterId === 'string' && /^[1-9][0-9]*$/.test(afterId)
                ? Number(afterId)
                : afterId,
            );
      const q = query === undefined ? '' : this.text(query, 100);
      const { organization } = await this.scope(actor, this.db.manager, true);
      const rows = await this.db
        .getRepository(EnterpriseMembership)
        .createQueryBuilder('membership')
        .innerJoin(User, 'user', 'user.id = membership.userId')
        .select('user.id', 'id')
        .addSelect('user.userId', 'userId')
        .addSelect('user.active', 'active')
        .addSelect('membership.team', 'team')
        .addSelect('membership.role', 'role')
        .where('membership.organizationId = :organizationId AND user.id > :after', {
          organizationId: organization.id,
          after,
        })
        .andWhere(
          q
            ? "(user.userId LIKE :search ESCAPE '!' OR membership.team LIKE :search ESCAPE '!' OR user.id = :exactId)"
            : '1=1',
          {
            search: '%' + q.replace(/[!%_]/g, ch => '!' + ch) + '%',
            exactId: /^[1-9][0-9]*$/.test(q) && Number.isSafeInteger(Number(q)) ? Number(q) : -1,
          },
        )
        .orderBy('user.id', 'ASC')
        .limit(21)
        .getRawMany();
      const entries = rows.slice(0, 20).map(row => ({
        ...row,
        active: row.active === true || row.active === 1 || row.active === '1',
      }));
      return {
        organizationVersion: organization.version,
        entries,
        nextAfterId: rows.length > 20 ? entries[entries.length - 1].id : null,
      };
    });
  }
  private async claim(manager: EntityManager, actor: number, expected: number) {
    const { organization } = await this.scope(actor, manager, true);
    if (organization.version !== expected)
      throw new ConflictException('다른 변경이 먼저 반영됐습니다. 최신 목록을 확인해 주세요.');
    const result = await manager.update(
      EnterpriseOrganization,
      { id: organization.id, version: expected },
      { version: expected + 1 },
    );
    if (result.affected !== 1)
      throw new ConflictException('다른 변경이 먼저 반영됐습니다. 최신 목록을 확인해 주세요.');
    return { ...organization, version: expected + 1 };
  }
  async add(actor: number, body: unknown) {
    const input = this.fields(body, [
      'userId',
      'team',
      'role',
      'expectedVersion',
      'enrollmentCode',
    ]);
    if (typeof input.enrollmentCode !== 'string' || !/^[a-f0-9]{64}$/.test(input.enrollmentCode))
      throw new BadRequestException('직원이 발급한 조직 연결 코드를 확인해 주세요.');
    const userId = this.text(input.userId, 255, true),
      team = this.text(input.team, 100),
      role = this.role(input.role),
      version = this.version(input.expectedVersion);
    return this.mutation(async manager => {
      const organization = await this.claim(manager, actor, version);
      const invalidEnrollment = () =>
        new BadRequestException('직원 계정과 조직 연결 코드를 확인해 주세요.');
      const codeHash = createHash('sha256').update(input.enrollmentCode).digest('hex');
      const enrollment = await manager.findOneBy(EnterpriseEnrollment, {
        codeHash,
        organizationId: organization.id,
        expiresAt: MoreThan(new Date()),
      });
      if (!enrollment) throw invalidEnrollment();
      const consent = await manager.delete(EnterpriseEnrollment, {
        userId: enrollment.userId,
        codeHash,
        organizationId: organization.id,
        expiresAt: MoreThan(new Date()),
      });
      if (consent.affected !== 1) throw invalidEnrollment();
      const matches = await manager.find(User, { where: { userId }, take: 2 });
      const user =
        matches.length === 1
          ? await manager.findOne(User, {
              where: { id: matches[0].id, userId },
              ...(manager.connection.options.type !== 'sqlite'
                ? { lock: { mode: 'pessimistic_write' as const } }
                : {}),
            })
          : null;
      if (
        !user ||
        user.id !== enrollment.userId ||
        user.active === false ||
        (await manager.findOneBy(EnterpriseMembership, { userId: user.id }))
      )
        throw invalidEnrollment();
      await manager.insert(EnterpriseMembership, {
        userId: user.id,
        organizationId: organization.id,
        role,
        team,
      });
      await this.audit(
        manager,
        organization.id,
        actor,
        'member.added',
        user.id,
        organization.version,
      );
      return {
        organizationVersion: organization.version,
        member: { id: user.id, userId: user.userId, team, role, active: true },
      };
    });
  }
  async update(actor: number, target: unknown, body: unknown) {
    const targetId = this.id(target),
      input = this.fields(body, ['team', 'role', 'active', 'expectedVersion']);
    const team = this.text(input.team, 100),
      role = this.role(input.role),
      version = this.version(input.expectedVersion);
    if (typeof input.active !== 'boolean')
      throw new BadRequestException('활성 상태를 확인해 주세요.');
    if (targetId === actor && (role !== 'admin' || !input.active))
      throw new BadRequestException('자신의 관리자 권한·활성을 회수할 수 없습니다.');
    return this.mutation(async manager => {
      const organization = await this.claim(manager, actor, version);
      const member = await manager.findOneBy(EnterpriseMembership, {
        userId: targetId,
        organizationId: organization.id,
      });
      const user = member && (await manager.findOneBy(User, { id: targetId }));
      if (!member || !user) throw new ForbiddenException('이 조직의 직원만 변경할 수 있습니다.');
      await manager.update(
        EnterpriseMembership,
        { userId: targetId, organizationId: organization.id },
        { team, role },
      );
      if (user.active !== input.active)
        await manager.update(
          User,
          { id: targetId },
          { active: input.active, authVersion: (user.authVersion ?? 0) + 1, jwtId: null },
        );
      await this.audit(
        manager,
        organization.id,
        actor,
        'member.updated',
        targetId,
        organization.version,
      );
      return {
        organizationVersion: organization.version,
        member: { id: user.id, userId: user.userId, team, role, active: input.active },
      };
    });
  }
}
