import { MigrationInterface, QueryRunner, TableCheck, TableColumn } from 'typeorm';

/** Report comment threads shared with current recipients ('participants'); existing rows stay private. */
export class AddCommentThreadVisibility1793600000000 implements MigrationInterface {
  name = 'AddCommentThreadVisibility1793600000000';

  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('artifact_comment_thread'))) return;
    if (!(await runner.hasColumn('artifact_comment_thread', 'visibility')))
      await runner.addColumn(
        'artifact_comment_thread',
        new TableColumn({
          name: 'visibility',
          type: 'varchar',
          length: '16',
          isNullable: false,
          default: "'private'",
        }),
      );
    const table = await runner.getTable('artifact_comment_thread');
    if (!table?.checks.some(check => check.name === 'CHK_artifact_comment_thread_visibility'))
      await runner.createCheckConstraint(
        'artifact_comment_thread',
        new TableCheck({
          name: 'CHK_artifact_comment_thread_visibility',
          expression: `"visibility" IN ('private', 'participants')`,
        }),
      );
  }

  async down(): Promise<void> {
    throw new Error('comment thread visibility rollback requires a reviewed backup plan.');
  }
}
