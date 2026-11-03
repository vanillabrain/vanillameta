import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export const DASHBOARD_COMMENT_COLUMNS = [
  { name: 'artifactRevision', type: 'varchar', length: '64', isNullable: true },
  { name: 'anchorLabel', type: 'text', isNullable: true },
  { name: 'anchorType', type: 'varchar', length: '32', isNullable: true },
];

/**
 * Dashboard comment threads (dashboard-comment.service.ts): the dashboardRevision the author saw
 * and the chart title/type snapshot of a block anchor, on ArtifactCommentThread.
 */
export class AddDashboardCommentAnchor1793580000000 implements MigrationInterface {
  name = 'AddDashboardCommentAnchor1793580000000';

  async up(runner: QueryRunner): Promise<void> {
    for (const column of DASHBOARD_COMMENT_COLUMNS)
      if (!(await runner.hasColumn('artifact_comment_thread', column.name)))
        await runner.addColumn('artifact_comment_thread', new TableColumn(column));
  }

  async down(): Promise<void> {
    throw new Error('dashboard comment anchor rollback requires a reviewed backup plan.');
  }
}
