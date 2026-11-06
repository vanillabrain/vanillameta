import { randomUUID } from 'crypto';
import { EntityManager, LessThan, Not } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { DashboardRevision } from './entities/dashboard-revision.entity';

/** Who made a save: a person, or an external AI acting through one named connection. */
export type RevisionAuthor =
  | { kind: 'human' }
  | { kind: 'external-ai'; grantId: string; clientName: string };
export const HUMAN_AUTHOR: RevisionAuthor = { kind: 'human' };

/**
 * An external AI can save fast. Without a cap it could push every earlier version out of a bounded
 * history in minutes, so only its own 'save'/'restore' rows are capped. A person's rows and every
 * 'create' row stay.
 */
export const AI_REVISIONS_KEPT = 50;

/**
 * Set DASHBOARD_REVISION_HISTORY=off to stop writing a person's creates and saves without a deploy of code. An
 * external AI's saves are always written: the history is what lets a person undo what an AI did,
 * so switching it off must never leave an AI write unrecorded.
 */
export const revisionHistoryEnabled = (author: RevisionAuthor = HUMAN_AUTHOR) =>
  author.kind === 'external-ai' || process.env.DASHBOARD_REVISION_HISTORY !== 'off';

/**
 * Writes one history row for the dashboard as it is now. Call it inside the transaction that saved
 * the dashboard, with the row read back after the save, so the history can never describe a state
 * that was not committed.
 */
export async function recordDashboardRevision(
  manager: EntityManager,
  input: {
    dashboard: Dashboard;
    actorId: number;
    /** The JSON written to `studio_state.document` by the same save. */
    studioDocument: string;
    revision: string;
    operation: DashboardRevision['operation'];
    author?: RevisionAuthor;
    requestId?: string;
    /** Record even when the history flag is off (the row that makes an AI write undoable). */
    always?: boolean;
  },
): Promise<void> {
  const author = input.author ?? HUMAN_AUTHOR;
  if (!input.always && !revisionHistoryEnabled(author)) return;
  const { dashboard, actorId, operation, requestId } = input;
  const member = await manager.findOneBy(EnterpriseMembership, { userId: actorId });
  await manager.insert(DashboardRevision, {
    revisionId: randomUUID(),
    dashboardId: dashboard.id,
    revision: input.revision,
    studioDocument: input.studioDocument,
    title: dashboard.title,
    layout: dashboard.layout,
    analysisDefinition: dashboard.analysisDefinition ?? null,
    structuredDefinition: dashboard.structuredDefinition ?? null,
    pivotDefinitions: dashboard.pivotDefinitions ?? null,
    actorId,
    organizationId: member?.organizationId ?? null,
    operation,
    authorKind: author.kind,
    aiGrantId: author.kind === 'external-ai' ? author.grantId : null,
    aiClientName: author.kind === 'external-ai' ? author.clientName : null,
    requestId: requestId ?? null,
    createdAt: new Date().toISOString(),
  });
  if (author.kind !== 'external-ai' || operation === 'create') return;
  const newest = await manager.find(DashboardRevision, {
    select: { seq: true },
    where: { dashboardId: dashboard.id, authorKind: 'external-ai', operation: Not('create') },
    order: { seq: 'DESC' },
    take: AI_REVISIONS_KEPT,
  });
  if (newest.length < AI_REVISIONS_KEPT) return;
  await manager.delete(DashboardRevision, {
    dashboardId: dashboard.id,
    authorKind: 'external-ai',
    operation: Not('create'),
    seq: LessThan(newest[newest.length - 1].seq),
  });
}

/** A dashboard's history goes with it (deletion, hand-over), like its comments. */
export async function deleteDashboardRevisions(
  manager: EntityManager,
  dashboardId: number,
): Promise<void> {
  await manager.delete(DashboardRevision, { dashboardId });
}

/**
 * Before an external AI writes, keep the state it replaces if the history does not already hold it:
 * the history may be new, the flag may have been off, or a path that records nothing (a lifecycle
 * change, a legacy pivot edit) may have moved the dashboard since the last row. The row says "the
 * dashboard was in this state", written by a person's or an unknown path, so it carries no author.
 */
export async function recordBaselineBeforeAiWrite(
  manager: EntityManager,
  input: { dashboard: Dashboard; actorId: number; studioDocument: string; revision: string },
): Promise<void> {
  const latest = await manager.findOne(DashboardRevision, {
    select: { seq: true, revision: true },
    where: { dashboardId: input.dashboard.id },
    order: { seq: 'DESC' },
  });
  if (latest?.revision === input.revision) return;
  await recordDashboardRevision(manager, { ...input, operation: 'baseline', always: true });
}
