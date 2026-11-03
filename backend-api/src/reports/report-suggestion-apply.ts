import { EntityManager, In, LessThan } from 'typeorm';
import { notifyThread } from './comment-notification';
import { ArtifactCommentThread, ArtifactSuggestion } from './report-comment.entity';
import { PrivateReport } from './report.entity';

/**
 * Marks suggestions applied in the transaction that wrote `newVersion` (report save, step 5).
 * Entities only: reports.service imports this, and importing report-comment.service there would
 * form a cycle through report-sharing.service. Skips ids that are not open, belong to another
 * report or are based on a version not older than `newVersion`; resolves a thread when it has no
 * open suggestion left, and notifies each affected thread once with 'suggestion.applied'.
 * Returns the ids whose appliedVersion is newVersion.
 */
export async function markSuggestionsApplied(
  manager: EntityManager,
  input: {
    reportId: string;
    newVersion: number;
    ids: readonly string[];
    /** The owner saving the version. */
    decidedBy: number;
    decidedAt?: string;
  },
): Promise<string[]> {
  if (!Number.isSafeInteger(input.decidedBy) || input.decidedBy <= 0)
    throw new Error('markSuggestionsApplied requires the deciding owner.');
  const ids = [...new Set(input.ids)];
  if (!ids.length) return [];
  const decidedBy = input.decidedBy;
  const decidedAt = input.decidedAt ?? new Date().toISOString();
  const candidates = await manager.find(ArtifactSuggestion, {
    where: {
      id: In(ids),
      artifactId: input.reportId,
      status: 'open',
      baseVersion: LessThan(input.newVersion),
    },
  });
  for (const row of candidates)
    await manager.update(
      ArtifactSuggestion,
      { id: row.id, status: 'open', statusVersion: row.statusVersion },
      {
        status: 'applied',
        statusVersion: row.statusVersion + 1,
        appliedVersion: input.newVersion,
        decidedBy,
        decidedAt,
      },
    );
  const head = candidates.length
    ? await manager.findOneBy(PrivateReport, { id: input.reportId })
    : null;
  for (const threadId of new Set(candidates.map(row => row.threadId))) {
    if (head)
      await notifyThread(manager, {
        reportId: head.id,
        ownerId: head.ownerId,
        organizationKey: head.organizationKey,
        threadId,
        event: 'suggestion.applied',
        actor: { id: decidedBy, kind: 'user', clientName: null },
        now: decidedAt,
        suggestionBaseVersion: Math.min(
          ...candidates.filter(row => row.threadId === threadId).map(row => row.baseVersion),
        ),
      });
    if (await manager.countBy(ArtifactSuggestion, { threadId, status: 'open' })) continue;
    const thread = await manager.findOneBy(ArtifactCommentThread, { id: threadId });
    if (thread?.status === 'open')
      await manager.update(
        ArtifactCommentThread,
        { id: threadId, status: 'open', statusVersion: thread.statusVersion },
        {
          status: 'resolved',
          statusVersion: thread.statusVersion + 1,
          resolvedBy: decidedBy,
          resolvedAt: decidedAt,
        },
      );
  }
  return appliedSuggestionIds(manager, input.reportId, input.newVersion, ids);
}

/** Ids among `ids` that the save which wrote `version` applied; replays read the same rows. */
export async function appliedSuggestionIds(
  manager: EntityManager,
  reportId: string,
  version: number,
  ids: readonly string[] | undefined,
): Promise<string[]> {
  if (!ids?.length) return [];
  const rows = await manager.find(ArtifactSuggestion, {
    select: { id: true },
    where: { id: In([...ids]), artifactId: reportId, appliedVersion: version },
  });
  return rows.map(row => row.id).sort();
}
