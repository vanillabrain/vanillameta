import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { SourceAccessService, SourceAsset } from '../ownership/source-access.service';

export interface LegacyJobActor {
  id: number;
  userId: string;
  authVersion: number;
}

export function legacyJobActor(user: any): LegacyJobActor {
  const actor = user?.accessKeyData;
  if (
    !Number.isSafeInteger(actor?.id) ||
    actor.id <= 0 ||
    typeof actor.userId !== 'string' ||
    !actor.userId ||
    !Number.isSafeInteger(actor.authVersion ?? 0) ||
    (actor.authVersion ?? 0) < 0
  )
    throw new ForbiddenException('Personal authentication required');
  return { id: actor.id, userId: actor.userId, authVersion: actor.authVersion ?? 0 };
}

export async function assertLegacyActor(db: DataSource, actor: LegacyJobActor): Promise<void> {
  const checked = legacyJobActor({ accessKeyData: actor });
  const current = await db
    .getRepository(User)
    .findOne({ where: { id: checked.id, userId: checked.userId } });
  if (!current || current.active === false || (current.authVersion ?? 0) !== checked.authVersion)
    throw new ForbiddenException('Job actor revoked');
}

export async function assertLegacySource(
  access: SourceAccessService,
  kind: SourceAsset,
  id: unknown,
  actor: LegacyJobActor,
): Promise<void> {
  // Legacy SQL is unrestricted; read grants alone never authorize arbitrary SQL.
  await access.assert(kind, id, actor.id, 'owner');
  await access.assert(kind, id, actor.id, 'read');
}
