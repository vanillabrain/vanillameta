import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import {
  assertClassificationContext,
  ClassificationActor,
  classificationContext,
  ClassificationContext,
} from './classification-context';
import {
  EnterpriseClassification,
  EnterpriseClassificationRequest,
} from './entities/enterprise-classification.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';

const MAX_VERSION = 2147483647;
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const entry = ({ id, name, active, version }: EnterpriseClassification) => ({
  id,
  name,
  active,
  version,
});
function keys(body: any, expected: string[]) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).length !== expected.length ||
    Object.keys(body).some(key => !expected.includes(key))
  )
    throw new BadRequestException('분류 변경 항목을 확인해 주세요.');
  if (!positive(body.expectedActorId) || !positive(body.expectedOrganizationId))
    throw new BadRequestException('계정과 조직 번호를 확인해 주세요.');
}
export function classificationName(value: unknown) {
  if (typeof value !== 'string')
    throw new BadRequestException('분류 이름(1~80자)을 확인해 주세요.');
  const name = value.normalize('NFKC').trim();
  // Validate controls before trimming too, so line breaks cannot be hidden at an edge.
  if (!name || name.length > 80 || /[\p{Cc}\p{Cs}]/u.test(value) || /[\p{Cc}\p{Cs}]/u.test(name))
    throw new BadRequestException('분류 이름(1~80자, 제어문자 제외)을 확인해 주세요.');
  return { name, nameKey: hash(name.toLowerCase()) };
}
@Injectable()
export class EnterpriseClassificationService {
  constructor(private readonly db: DataSource) {}
  private admin(context: ClassificationContext) {
    if (!context.canManage)
      throw new ForbiddenException('현재 조직 관리자만 분류를 관리할 수 있습니다.');
  }
  private creationReceipt(raw: string, actorId: number, organizationId: number, name: string) {
    try {
      const value = JSON.parse(raw);
      const exact = (object: any, allowed: string[]) =>
        object &&
        typeof object === 'object' &&
        !Array.isArray(object) &&
        Object.keys(object).length === allowed.length &&
        Object.keys(object).every(key => allowed.includes(key));
      if (
        !exact(value, ['actorId', 'organizationId', 'entry']) ||
        value.actorId !== actorId ||
        value.organizationId !== organizationId ||
        !exact(value.entry, ['id', 'name', 'active', 'version']) ||
        !positive(value.entry.id) ||
        value.entry.name !== name ||
        classificationName(value.entry.name).name !== name ||
        value.entry.active !== true ||
        value.entry.version !== 1
      )
        throw new Error('invalid creation receipt');
      return {
        actorId,
        organizationId,
        entry: { id: value.entry.id as number, name, active: true, version: 1 },
      };
    } catch {
      throw new ConflictException('분류 생성 기록을 확인할 수 없습니다. 관리자에게 확인해 주세요.');
    }
  }
  private async write<T>(run: (manager: EntityManager) => Promise<T>) {
    try {
      return await metadataTransaction(this.db, run);
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
        throw new ConflictException(
          '같은 이름이 있거나 분류 변경이 경합 중입니다. 최신 상태를 확인해 주세요.',
        );
      throw error;
    }
  }
  async list(actor: number, authVersion: number | undefined, afterId?: unknown) {
    if (afterId !== undefined && !positive(afterId))
      throw new BadRequestException('목록 위치를 확인해 주세요.');
    const trusted = { id: actor, authVersion };
    return serializeMetadataWork(this.db, async () => {
      const context = await classificationContext(this.db.manager, trusted);
      const rows = await this.db.manager
        .createQueryBuilder(EnterpriseClassification, 'classification')
        .where('classification.organizationId = :org AND classification.id > :after', {
          org: context.organizationId,
          after: afterId ?? 0,
        })
        .orderBy('classification.id', 'ASC')
        .take(21)
        .getMany();
      const current = await assertClassificationContext(this.db.manager, trusted, context);
      if (context.canManage !== current.canManage)
        throw new ConflictException('조직 역할이 변경되었습니다. 목록을 다시 확인해 주세요.');
      return {
        actorId: actor,
        organizationId: context.organizationId,
        canManage: context.canManage,
        entries: rows.slice(0, 20).map(entry),
        nextAfterId: rows.length > 20 ? rows[19].id : null,
      };
    });
  }
  async create(actor: number, authVersion: number | undefined, body: any) {
    keys(body, ['expectedActorId', 'expectedOrganizationId', 'requestId', 'name']);
    if (
      typeof body.requestId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.requestId)
    )
      throw new BadRequestException('분류 생성 요청 번호를 확인해 주세요.');
    const normalized = classificationName(body.name);
    const trusted: ClassificationActor = { id: actor, authVersion };
    const expected = { actorId: body.expectedActorId, organizationId: body.expectedOrganizationId };
    const requestId = body.requestId as string;
    const payloadHash = hash(
      JSON.stringify([expected.actorId, expected.organizationId, normalized.name]),
    );
    return this.write(async manager => {
      const context = await assertClassificationContext(manager, trusted, expected, true);
      this.admin(context);
      const prior = await manager.findOneBy(EnterpriseClassificationRequest, {
        actorId: actor,
        requestId,
      });
      if (prior) {
        if (prior.organizationId !== context.organizationId || prior.payloadHash !== payloadHash)
          throw new ConflictException('같은 요청 번호의 분류 내용 또는 조직이 다릅니다.');
        return {
          ...this.creationReceipt(prior.result, actor, context.organizationId, normalized.name),
          replayed: true,
        };
      }
      const row = await manager.save(EnterpriseClassification, {
        organizationId: context.organizationId,
        ...normalized,
        active: true,
        version: 1,
      });
      const result = { actorId: actor, organizationId: context.organizationId, entry: entry(row) };
      await manager.insert(EnterpriseAuditEvent, {
        organizationId: context.organizationId,
        actorId: actor,
        action: 'classification.created',
        resourceId: row.id,
        subjectId: null,
        version: row.version,
      });
      await manager.insert(EnterpriseClassificationRequest, {
        actorId: actor,
        requestId,
        organizationId: context.organizationId,
        payloadHash,
        result: JSON.stringify(result),
      });
      return { ...result, replayed: false };
    });
  }
  async set(id: number, actor: number, authVersion: number | undefined, body: any) {
    keys(body, ['expectedActorId', 'expectedOrganizationId', 'expectedVersion', 'name', 'active']);
    if (
      !positive(id) ||
      !positive(body.expectedVersion) ||
      body.expectedVersion > MAX_VERSION ||
      typeof body.active !== 'boolean'
    )
      throw new BadRequestException('분류 번호·버전·활성 상태를 확인해 주세요.');
    const normalized = classificationName(body.name);
    const trusted = { id: actor, authVersion };
    return this.write(async manager => {
      const context = await assertClassificationContext(
        manager,
        trusted,
        { actorId: body.expectedActorId, organizationId: body.expectedOrganizationId },
        true,
      );
      this.admin(context);
      const row = await manager.findOne(EnterpriseClassification, {
        where: { id, organizationId: context.organizationId },
        ...(this.db.options.type !== 'sqlite'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!row) throw new ForbiddenException('현재 조직의 분류만 변경할 수 있습니다.');
      if (row.version !== body.expectedVersion)
        throw new ConflictException('분류가 변경되었습니다. 최신 목록을 확인해 주세요.');
      if (row.name === normalized.name && row.active === body.active)
        return { actorId: actor, organizationId: context.organizationId, entry: entry(row) };
      if (row.version >= MAX_VERSION) throw new ConflictException('분류 버전 한도에 도달했습니다.');
      const result = await manager.update(
        EnterpriseClassification,
        { id, organizationId: context.organizationId, version: body.expectedVersion },
        { ...normalized, active: body.active, version: row.version + 1 },
      );
      if (result.affected !== 1)
        throw new ConflictException('분류가 변경되었습니다. 최신 목록을 확인해 주세요.');
      await manager.insert(EnterpriseAuditEvent, {
        organizationId: context.organizationId,
        actorId: actor,
        action: 'classification.changed',
        resourceId: id,
        subjectId: null,
        version: row.version + 1,
      });
      return {
        actorId: actor,
        organizationId: context.organizationId,
        entry: { id, name: normalized.name, active: body.active, version: row.version + 1 },
      };
    });
  }
}
