import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

/**
 * In-app comment notifications, one row per recipient (ArtifactCommentNotification), and the
 * relation version at which a report share last became readable (ReportDelivery).
 */
export class AddArtifactCommentNotification1793590000000 implements MigrationInterface {
  name = 'AddArtifactCommentNotification1793590000000';

  async up(runner: QueryRunner): Promise<void> {
    if (
      (await runner.hasTable('private_report_delivery')) &&
      !(await runner.hasColumn('private_report_delivery', 'activatedRelationVersion'))
    )
      await runner.addColumn(
        'private_report_delivery',
        new TableColumn({ name: 'activatedRelationVersion', type: 'integer', default: '0' }),
      );
    if (await runner.hasTable('artifact_comment_notification')) return;
    await runner.createTable(
      new Table({
        name: 'artifact_comment_notification',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'recipientId', type: 'integer' },
          { name: 'organizationKey', type: 'integer' },
          { name: 'artifactKind', type: 'varchar', length: '16' },
          { name: 'artifactId', type: 'varchar', length: '36' },
          { name: 'threadId', type: 'varchar', length: '36' },
          { name: 'event', type: 'varchar', length: '32' },
          { name: 'actorKind', type: 'varchar', length: '8' },
          { name: 'actorId', type: 'integer' },
          { name: 'aiClientName', type: 'varchar', length: '255', isNullable: true },
          { name: 'relationVersion', type: 'integer', isNullable: true },
          { name: 'createdAt', type: 'varchar', length: '32' },
          { name: 'readAt', type: 'varchar', length: '32', isNullable: true },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_artifact_comment_notification_recipient',
            columnNames: ['recipientId', 'createdAt'],
          }),
          new TableIndex({
            name: 'IDX_artifact_comment_notification_artifact',
            columnNames: ['artifactKind', 'artifactId'],
          }),
        ],
      }),
    );
  }

  async down(): Promise<void> {
    throw new Error('comment notification rollback requires a reviewed backup plan.');
  }
}
