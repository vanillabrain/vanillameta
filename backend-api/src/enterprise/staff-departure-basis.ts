import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { User } from '../user/entities/user.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { StudioExecution } from '../dashboard-studio/entities/studio-execution.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { FileRefresh } from '../database/entities/file-refresh.entity';
import { SourceDeleteReceipt } from '../database/entities/source-delete-receipt.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import {
  EnterpriseGroup,
  EnterpriseGroupGrant,
  EnterpriseGroupMember,
} from './entities/enterprise-group.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseStaffTransfer } from './entities/enterprise-staff-transfer.entity';
import { EnterpriseSourceHandover } from './entities/enterprise-source-handover.entity';
import { EnterpriseHandoverTransfer } from './entities/enterprise-handover-transfer.entity';
import { EnterpriseBundleHandover } from './entities/enterprise-bundle-handover.entity';
import { sourceHandoverAdmissions } from './source-handover-basis';

export function departureHash(value: unknown): string {
  const stable = (v: any): any =>
    v instanceof Date
      ? v.toISOString()
      : Array.isArray(v)
      ? v.map(stable)
      : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, stable(v[k])]),
        )
      : v;
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}
export const departureRelations = [
  [EnterpriseResourceGrant, '(r.ownerId = :user OR r.recipientId = :user)'],
  [EnterpriseDashboardDelivery, '(r.ownerId = :user OR r.recipientId = :user)'],
  [EnterpriseGroupGrant, 'r.ownerId = :user'],
  [EnterpriseGroupDelivery, 'r.ownerId = :user'],
] as const;

/** Counts only outside this module; no names, job payloads, source configs or file contents. */
export async function inspectStaffDeparture(
  manager: EntityManager,
  user: number,
  organizationId: number,
) {
  const blockers = new Set<string>();
  const read = async (entity: any, predicate: string, select: string[], parameters: any = {}) => {
    const rows = await manager
      .createQueryBuilder(entity, 'r')
      .select(select.map(k => `r.${k}`))
      .where(predicate, { user, ...parameters })
      .orderBy('1')
      .getMany();
    return rows;
  };
  const sources = await manager.count(Database, { where: { ownerId: user } });
  // Count mappings themselves: duplicate mappings and orphan dashboard IDs also block.
  const dashboards = await manager.count(UserMapping, { where: { userInfoId: user } });
  const publications = await read(StudioPublication, 'r.actorId = :user', [
    'token',
    'version',
    'revokedAt',
  ]);
  const legacy = await read(DashboardPublication, 'r.publisherId = :user', [
    'dashboardId',
    'version',
    'active',
  ]);
  const exportJobs = await read(ExportJob, '(r.ownerId = :user OR r.sourceOwnerId = :user)', [
    'id',
    'status',
    'version',
    'attemptToken',
    'leaseUntil',
    'expiresAt',
  ]);
  const refreshes = await read(FileRefresh, 'r.actorId = :user', [
    'id',
    'status',
    'inputRetained',
    'leaseToken',
    'leaseUntil',
  ]);
  const executions = await read(StudioExecution, 'r.actorId = :user', [
    'runId',
    'status',
    'updatedAt',
  ]);
  const cleanup = await read(SourceDeleteReceipt, 'r.actorId = :user', [
    'id',
    'cleanupStatus',
    'cleanupVersion',
    'cleanupAttempt',
    'cleanupLeaseUntil',
  ]);
  const handovers = [];
  for (const entity of [
    EnterpriseSourceHandover,
    EnterpriseHandoverTransfer,
    EnterpriseBundleHandover,
  ])
    handovers.push(
      ...(await read(entity, '(r.ownerId = :user OR r.recipientId = :user)', [
        'proposalId',
        'status',
        'version',
        'expiresAt',
      ])),
    );
  const transfers = await read(
    EnterpriseStaffTransfer,
    '(r.userId = :user OR r.acceptedBy = :user)',
    ['userId', 'completed', 'expiresAt', 'codeHash', 'acceptedBy', 'acceptedEpoch'],
  );
  const relationships = [];
  for (const [entity, predicate] of departureRelations) {
    const query = manager.createQueryBuilder(entity, 'r').where(predicate, { user });
    for (const column of manager.connection.getMetadata(entity).primaryColumns)
      query.addOrderBy(`r.${column.propertyName}`, 'ASC');
    relationships.push(await query.getMany());
  }
  const joins = await manager.find(EnterpriseGroupMember, {
    where: { userId: user },
    order: { groupId: 'ASC' },
  });
  const groups = [];
  for (const join of joins)
    groups.push(await manager.findOneBy(EnterpriseGroup, { id: join.groupId }));
  const enrollments = await manager.find(EnterpriseEnrollment, { where: { userId: user } });
  const admins = await manager
    .createQueryBuilder(EnterpriseMembership, 'm')
    .innerJoin(User, 'u', 'u.id = m.userId')
    .select('m.userId', 'id')
    .addSelect('u.authVersion', 'epoch')
    .where('m.organizationId = :org AND m.role = :role AND u.active = :active', {
      org: organizationId,
      role: 'admin',
      active: true,
    })
    .orderBy('m.userId')
    .getRawMany();
  const admissions = await sourceHandoverAdmissions(user);
  const now = Date.now();
  const counts = {
    ownedSources: sources,
    ownedDashboards: dashboards,
    activePublications:
      publications.filter(r => !r.revokedAt).length + legacy.filter(r => r.active).length,
    openExports: exportJobs.filter(
      r =>
        r.attemptToken !== null ||
        r.leaseUntil !== null ||
        ['queued', 'running'].includes(r.status) ||
        (r.status === 'ready' && r.expiresAt.getTime() > now) ||
        !['queued', 'running', 'ready', 'failed', 'cancelled'].includes(r.status),
    ).length,
    openRefreshes:
      refreshes.filter(
        r =>
          r.inputRetained ||
          r.leaseToken !== null ||
          r.leaseUntil !== null ||
          !['succeeded', 'failed', 'interrupted', 'cancelled'].includes(r.status),
      ).length +
      admissions.filter((a: any) => typeof a === 'string' || !refreshes.some(r => r.id === a.id))
        .length,
    openExecutions: executions.filter(
      r => !['succeeded', 'unsupported', 'cancelled'].includes(r.status),
    ).length,
    pendingHandovers: handovers.filter(
      r => ['prepared', 'accepted'].includes(r.status) && r.expiresAt.getTime() > now,
    ).length,
    pendingTransfer: transfers.filter(r => !r.completed && r.expiresAt.getTime() > now).length,
    pendingCleanup: cleanup.filter(
      r =>
        r.cleanupStatus !== 'complete' || r.cleanupAttempt !== null || r.cleanupLeaseUntil !== null,
    ).length,
  };
  if (sources || dashboards) blockers.add('owned_assets');
  if (counts.activePublications) blockers.add('active_publications');
  if (counts.openExports || counts.openRefreshes || counts.openExecutions || counts.pendingCleanup)
    blockers.add('open_work');
  if (counts.pendingHandovers) blockers.add('pending_handover');
  if (counts.pendingTransfer) blockers.add('pending_transfer');
  if (!admins.some(r => Number(r.id) !== user)) blockers.add('last_admin');
  if (
    admissions.some(r => typeof r === 'string') ||
    groups.some(
      g => !g || !Number.isSafeInteger(g.version) || g.version < 1 || g.version >= 2147483647,
    ) ||
    relationships
      .flat()
      .some(r => !Number.isSafeInteger(r.version) || r.version < 0 || r.version >= 2147483647)
  )
    blockers.add('unsupported_state');
  return {
    counts,
    blockers: [...blockers].sort(),
    relationships,
    joins,
    groups,
    hash: departureHash({
      counts,
      publications,
      legacy,
      exportJobs,
      refreshes,
      executions,
      cleanup,
      handovers,
      transfers,
      relationships,
      joins,
      groups,
      enrollments,
      admins,
      admissions,
    }),
  };
}
