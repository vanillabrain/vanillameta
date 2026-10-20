import { serializeMetadataWork } from '../common/metadata-work';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
import { serializeEnterpriseWrite } from './enterprise-write';

@Injectable()
export class SourceLifecycleService {
  constructor(
    private readonly db: DataSource,
    private readonly policy: EnterpriseResourcePolicyService,
  ) {}
  private async row(sourceId: number, actor: number, manager: EntityManager) {
    await this.policy.assertManagement('source', sourceId, actor, manager);
    const row = await manager.findOne(Database, {
      where: { id: sourceId },
      select: { id: true, catalogActive: true, catalogVersion: true },
    });
    if (!row) throw new ForbiddenException('소스 상태를 관리할 수 없습니다.');
    return row;
  }
  private output(row: Database) {
    return { sourceId: row.id, active: row.catalogActive, version: row.catalogVersion };
  }
  async read(sourceId: number, actor: number) {
    return serializeMetadataWork(this.db, async () => {
      return this.output(await this.row(sourceId, actor, this.db.manager));
    });
  }
  async set(sourceId: number, actor: number, body: any) {
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 2 ||
      Object.keys(body).some(k => !['expectedVersion', 'active'].includes(k)) ||
      typeof body.active !== 'boolean' ||
      !Number.isSafeInteger(body.expectedVersion) ||
      body.expectedVersion < 0 ||
      body.expectedVersion >= 2147483647
    )
      throw new BadRequestException('소스 상태와 현재 버전을 확인해 주세요.');
    return serializeEnterpriseWrite(this.db, async () => {
      try {
        return await this.db.transaction(async manager => {
          const row = await this.row(sourceId, actor, manager);
          if (row.catalogVersion !== body.expectedVersion)
            throw new ConflictException(
              '소스 상태가 변경됐습니다. 최신 상태를 다시 확인해 주세요.',
            );
          const version = row.catalogVersion + 1;
          const changed = await manager.update(
            Database,
            { id: sourceId, ownerId: actor, catalogVersion: body.expectedVersion },
            { catalogActive: body.active, catalogVersion: version },
          );
          if (changed.affected !== 1)
            throw new ConflictException(
              '소스 상태가 변경됐습니다. 최신 상태를 다시 확인해 주세요.',
            );
          const membership = await manager.findOneBy(EnterpriseMembership, { userId: actor });
          if (!membership) throw new ForbiddenException('소속을 다시 확인해 주세요.');
          await manager.insert(EnterpriseAuditEvent, {
            organizationId: membership.organizationId,
            actorId: actor,
            action: body.active ? 'source.activate' : 'source.deactivate',
            resourceId: sourceId,
            subjectId: null,
            version,
          });
          return { sourceId, active: body.active, version };
        });
      } catch (error) {
        if (
          error instanceof QueryFailedError &&
          [
            'SQLITE_BUSY',
            'SQLITE_LOCKED',
            'ER_DUP_ENTRY',
            'ER_LOCK_DEADLOCK',
            'ER_LOCK_WAIT_TIMEOUT',
          ].includes(error.driverError?.code)
        )
          throw new ConflictException(
            '소스 상태 변경이 경합 중입니다. 최신 상태를 다시 확인해 주세요.',
          );
        throw error;
      }
    });
  }
}
