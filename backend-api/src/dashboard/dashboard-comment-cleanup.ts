import { EntityManager } from 'typeorm';
import {
  ArtifactComment,
  ArtifactCommentReceipt,
  ArtifactCommentThread,
} from '../reports/report-comment.entity';
import { DASHBOARD_OPERATIONS } from './dashboard-comment-contract';

export const DASHBOARD_COMMENT_KIND = 'dashboard';

/**
 * Removes every comment, thread and write receipt of one dashboard. Callers delete or hand over
 * the dashboard in the same transaction after locking its row. Receipts have no FK and are found
 * through their result ids, so they go first while threads and comments still exist.
 */
export async function deleteDashboardComments(manager: EntityManager, dashboardId: number) {
  const artifactId = String(dashboardId);
  const parameters = { kind: DASHBOARD_COMMENT_KIND, artifactId };
  const threadIds = manager
    .createQueryBuilder(ArtifactCommentThread, 't')
    .select('"t"."id"')
    .where('"t"."artifactKind" = :kind AND "t"."artifactId" = :artifactId');
  const commentIds = manager
    .createQueryBuilder(ArtifactComment, 'c')
    .select('"c"."id"')
    .innerJoin(ArtifactCommentThread, 't', '"t"."id" = "c"."threadId"')
    .where('"t"."artifactKind" = :kind AND "t"."artifactId" = :artifactId');
  // PostgreSQL folds unquoted camelCase identifiers to lower case, so every column is quoted.
  await manager
    .createQueryBuilder()
    .delete()
    .from(ArtifactCommentReceipt)
    .where('"operation" IN (:...operations)')
    .andWhere(`("resultId" IN (${threadIds.getQuery()}) OR "resultId" IN (${commentIds.getQuery()}))`)
    .setParameters({ ...parameters, operations: [...DASHBOARD_OPERATIONS] })
    .execute();
  await manager
    .createQueryBuilder()
    .delete()
    .from(ArtifactComment)
    .where(`"threadId" IN (${threadIds.getQuery()})`)
    .setParameters(parameters)
    .execute();
  await manager.delete(ArtifactCommentThread, { artifactKind: DASHBOARD_COMMENT_KIND, artifactId });
}
