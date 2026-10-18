import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseClassification } from '../enterprise/entities/enterprise-classification.entity';
import { classificationContext } from '../enterprise/classification-context';
import { BusinessVariable, ClassificationRef, sameClassificationRef } from './business-variable';

export type CatalogActorContext = {
  actorId: number;
  authVersion: number;
  organizationId: number | null;
  role: string | null;
};
const stale = () =>
  new ConflictException('분류 또는 편집 기준이 변경됐습니다. 다시 확인해 주세요.');

/** Metadata only. Call before Source locks; organization-less legacy free text remains valid. */
export async function catalogActorContext(
  manager: EntityManager,
  actorId: number,
  authVersion?: number,
  lock = false,
): Promise<CatalogActorContext> {
  return serializeMetadataWork(manager.connection, async () => {
    if (!Number.isSafeInteger(actorId) || actorId <= 0)
      throw new ForbiddenException('현재 계정이 필요합니다.');
    if (lock && !manager.queryRunner?.isTransactionActive)
      throw new Error('Catalog actor lock requires a transaction.');
    const locking =
      lock && ['mysql', 'mariadb'].includes(manager.connection.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
    const user = await manager.findOne(User, { where: { id: actorId }, ...locking });
    if (!user || user.active !== true) throw new ForbiddenException('현재 활성 계정이 필요합니다.');
    if (
      !Number.isSafeInteger(user.authVersion) ||
      user.authVersion < 0 ||
      (authVersion !== undefined &&
        (!Number.isSafeInteger(authVersion) || authVersion < 0 || authVersion !== user.authVersion))
    )
      throw new UnauthorizedException('로그인 상태를 다시 확인해 주세요.');
    const member = await manager.findOne(EnterpriseMembership, {
      where: { userId: actorId },
      ...locking,
    });
    if (member) {
      // Reuse the registry's current actor/membership policy for every organizational
      // binding. The preliminary full User fence also supports legacy accounts with
      // no organization, which the registry itself intentionally does not expose.
      const current = await classificationContext(
        manager,
        { id: actorId, authVersion: user.authVersion },
        lock,
      );
      return {
        actorId: current.actorId,
        authVersion: current.authVersion,
        organizationId: current.organizationId,
        role: current.canManage ? 'admin' : 'member',
      };
    }
    return {
      actorId,
      authVersion: user.authVersion,
      organizationId: null,
      role: null,
    };
  });
}

export async function assertCatalogActor(
  manager: EntityManager,
  captured: CatalogActorContext,
  lock = false,
) {
  const current = await catalogActorContext(manager, captured.actorId, captured.authVersion, lock);
  if (JSON.stringify(current) !== JSON.stringify(captured)) throw stale();
}

export type ClassificationBinding = { ref: ClassificationRef; name: string };

/** Only new/adopted references are queried. Historical references never enter this function. */
export async function resolveCatalogBindings<T extends BusinessVariable & { column: string }>(
  manager: EntityManager,
  context: CatalogActorContext,
  columns: T[],
  previous: Array<BusinessVariable & { column: string }>,
): Promise<{ columns: T[]; bindings: ClassificationBinding[] }> {
  const selected = columns.filter(column => {
    const old = previous.find(value => value.column === column.column);
    return (
      column.classificationRef &&
      !sameClassificationRef(column.classificationRef, old?.classificationRef)
    );
  });
  const bindings = await readBindings(
    manager,
    context,
    selected.map(column => column.classificationRef),
  );
  return {
    columns: columns.map(column => {
      if (!selected.some(value => value.column === column.column)) return column;
      const binding = bindings.find(value =>
        sameClassificationRef(value.ref, column.classificationRef),
      );
      return binding ? { ...column, classification: binding.name } : column;
    }),
    bindings,
  };
}

async function readBindings(
  manager: EntityManager,
  context: CatalogActorContext,
  refs: ClassificationRef[],
  lock = false,
): Promise<ClassificationBinding[]> {
  return serializeMetadataWork(manager.connection, async () => {
    if (lock && !manager.queryRunner?.isTransactionActive)
      throw new Error('Classification lock requires a transaction.');
    const unique = new Map<number, ClassificationRef>();
    for (const ref of refs) {
      if (!context.organizationId || ref.organizationId !== context.organizationId)
        throw new ForbiddenException('현재 조직의 활성 분류만 선택할 수 있습니다.');
      if (unique.has(ref.id) && !sameClassificationRef(unique.get(ref.id), ref)) throw stale();
      unique.set(ref.id, ref);
    }
    const bindings: ClassificationBinding[] = [];
    for (const ref of [...unique.values()].sort((a, b) => a.id - b.id)) {
      const row = await manager.findOne(EnterpriseClassification, {
        where: { id: ref.id, organizationId: context.organizationId },
        ...(lock && ['mysql', 'mariadb'].includes(manager.connection.options.type)
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (
        !row ||
        row.active !== true ||
        row.version !== ref.version ||
        typeof row.name !== 'string' ||
        !row.name.length ||
        row.name.length > 80 ||
        row.name !== row.name.normalize('NFKC').trim() ||
        /[\p{Cc}\p{Cs}]/u.test(row.name) ||
        row.nameKey !== createHash('sha256').update(row.name.toLowerCase(), 'utf8').digest('hex')
      )
        throw stale();
      bindings.push({ ref: { ...ref }, name: row.name });
    }
    return bindings;
  });
}

/** Caller has acquired User/membership, then Source parents, before this sorted lock set. */
export async function assertCatalogBindings(
  manager: EntityManager,
  context: CatalogActorContext,
  bindings: ClassificationBinding[],
  lock = false,
) {
  const current = await readBindings(
    manager,
    context,
    bindings.map(binding => binding.ref),
    lock,
  );
  if (JSON.stringify(current) !== JSON.stringify(bindings)) throw stale();
}
