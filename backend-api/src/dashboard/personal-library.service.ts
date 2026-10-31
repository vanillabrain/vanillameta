import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { User } from '../user/entities/user.entity';
import { DashboardService } from './dashboard.service';
import { PersonalLibraryState } from './entities/personal-library-state.entity';

const MAX_VERSION = 2147483647;

@Injectable()
export class PersonalLibraryService {
  constructor(
    private readonly db: DataSource,
    private readonly dashboards: DashboardService,
    private readonly access: SourceAccessService,
  ) {}

  private async scope(actor: number, epoch: number, manager: EntityManager, lock = false) {
    this.access.actor(actor);
    const locking =
      lock && this.db.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
    const user = await manager.findOne(User, {
      where: { id: actor },
      select: { id: true, active: true, authVersion: true },
      ...locking,
    });
    if (!user?.active) throw new ForbiddenException('활성 본인 계정이 필요합니다.');
    if (!Number.isSafeInteger(epoch) || epoch < 0 || user.authVersion !== epoch)
      throw new UnauthorizedException('로그인 상태를 다시 확인해 주세요.');
    const member = await manager.findOne(EnterpriseMembership, {
      where: { userId: actor },
      ...locking,
    });
    return member?.organizationId ?? null;
  }

  private stateVersion(state?: PersonalLibraryState) {
    if (!state) return 0;
    if (!Number.isInteger(state.version) || state.version < 1 || state.version > MAX_VERSION)
      throw new ConflictException('저장된 보관 버전을 확인해 주세요.');
    return state.version;
  }

  private listEntries(result: any): any[] {
    if (result?.status !== 'SUCCESS' || !Array.isArray(result.data))
      throw new InternalServerErrorException('대시보드 목록을 불러오지 못했습니다.');
    return result.data;
  }

  async list(actor: number, view: unknown = 'active', expectedEpoch = 0) {
    if (view !== 'active' && view !== 'archived')
      throw new BadRequestException('invalid library view');
    return serializeMetadataWork(this.db, async () => {
      const organizationId = await this.scope(actor, expectedEpoch, this.db.manager);
      // Preserve the existing read-list envelope pipeline, including every source read check.
      const upstream = await this.dashboards.findAll(
        actor,
        await this.access.readableDashboardIds(actor),
      );
      this.listEntries(upstream);
      const result = await this.access.filterResults('dashboard', actor, upstream, 'read');
      const readable = this.listEntries(result);
      const states =
        organizationId === null
          ? []
          : await this.db.manager.find(PersonalLibraryState, {
              where: { userId: actor, organizationId },
            });
      const byId = new Map(states.map(state => [state.dashboardId, state]));
      const entries = readable.flatMap(dashboard => {
        const state = byId.get(dashboard.id);
        const library = { archived: state?.archived ?? false, version: this.stateVersion(state) };
        return library.archived === (view === 'archived') ? [{ ...dashboard, library }] : [];
      });
      if ((await this.scope(actor, expectedEpoch, this.db.manager)) !== organizationId)
        throw new ForbiddenException('현재 조직이 변경되었습니다. 다시 조회해 주세요.');
      return {
        status: 'SUCCESS',
        data: {
          entries,
          canArchive: organizationId !== null,
          organizationId,
          actorId: actor,
          view,
        },
      };
    });
  }

  async update(id: unknown, actor: number, body: unknown, expectedEpoch = 0) {
    const dashboardId = this.access.id(id);
    const input = body as any;
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length !== 4 ||
      Object.keys(input).some(
        key =>
          !['archived', 'expectedVersion', 'expectedOrganizationId', 'expectedActorId'].includes(
            key,
          ),
      ) ||
      typeof input.archived !== 'boolean' ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      !Number.isSafeInteger(input.expectedOrganizationId) ||
      input.expectedOrganizationId <= 0 ||
      !Number.isSafeInteger(input.expectedActorId) ||
      input.expectedActorId <= 0
    )
      throw new BadRequestException('보관 상태와 현재 버전을 확인해 주세요.');
    // Capture validated primitives before queueing; callers cannot mutate an admitted request.
    const { archived, expectedVersion, expectedOrganizationId, expectedActorId } = input;
    const run = async (manager: EntityManager) => {
      const organizationId = await this.scope(actor, expectedEpoch, manager, true);
      if (organizationId === null)
        throw new ForbiddenException('보관에는 현재 조직 소속이 필요합니다.');
      if (actor !== expectedActorId)
        throw new ConflictException('현재 계정이 변경되었습니다. 다시 조회해 주세요.');
      if (organizationId !== expectedOrganizationId)
        throw new ConflictException('현재 조직이 변경되었습니다. 다시 조회해 주세요.');
      await this.access.dashboard(dashboardId, actor, 'read', manager);
      const key = { userId: actor, organizationId, dashboardId };
      const current = await manager.findOneBy(PersonalLibraryState, key);
      const version = this.stateVersion(current);
      if (expectedVersion > version)
        throw new ConflictException('보관 버전이 변경되었습니다. 다시 조회해 주세요.');
      if ((current?.archived ?? false) === archived)
        return { dashboardId, organizationId, archived, version };
      if (expectedVersion !== version || version === MAX_VERSION)
        throw new ConflictException('보관 버전이 변경되었습니다. 다시 조회해 주세요.');
      if (
        !current &&
        (await manager.count(PersonalLibraryState, { where: { userId: actor, organizationId } })) >=
          1000
      )
        throw new BadRequestException('개인 보관 상태는 조직별 최대 1000개입니다.');
      const next = { ...key, archived, version: version + 1, updatedAt: new Date() };
      if (current) {
        const changed = await manager.update(PersonalLibraryState, { ...key, version }, next);
        if (changed.affected !== 1) throw new ConflictException('보관 상태 저장이 경합 중입니다.');
      } else await manager.insert(PersonalLibraryState, next);
      await manager.insert(EnterpriseAuditEvent, {
        organizationId,
        actorId: actor,
        subjectId: actor,
        resourceId: dashboardId,
        action: archived ? 'dashboard.library-archived' : 'dashboard.library-restored',
        version: next.version,
      });
      // A read permission is never inferred from the saved personal state.
      await this.access.dashboard(dashboardId, actor, 'read', manager);
      if ((await this.scope(actor, expectedEpoch, manager)) !== organizationId)
        throw new ForbiddenException('현재 조직이 변경되었습니다.');
      return { dashboardId, organizationId, archived, version: next.version };
    };
    try {
      const data = await (this.db.options.type !== 'sqlite'
        ? metadataTransaction(this.db, 'READ COMMITTED', run)
        : metadataTransaction(this.db, run));
      return { status: 'SUCCESS', data };
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
            '40001',
            '40P01',
            '55P03',
          ].includes(error.driverError?.code))
      )
        throw new ConflictException('보관 상태 저장이 경합 중입니다. 다시 조회해 주세요.');
      throw error;
    }
  }
}
