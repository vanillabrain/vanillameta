import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const nullable = { isNullable: true };
const author = [
  { name: 'authorKind', type: 'varchar', length: '8' },
  { name: 'aiGrantId', type: 'varchar', length: '36', ...nullable },
  { name: 'aiClientName', type: 'varchar', length: '255', ...nullable },
];
const restrictThread = (name: string) =>
  new TableForeignKey({
    name,
    columnNames: ['threadId'],
    referencedTableName: 'artifact_comment_thread',
    referencedColumnNames: ['id'],
    onDelete: 'RESTRICT',
  });

/**
 * Report comments, replies, suggested edits and write receipts (report-comment.entity.ts), and the
 * AI provenance of report share receipts (report-sharing.entity.ts).
 */
export class AddArtifactComments1793560000000 implements MigrationInterface {
  name = 'AddArtifactComments1793560000000';

  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('artifact_comment_thread')))
      await runner.createTable(
        new Table({
          name: 'artifact_comment_thread',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'artifactKind', type: 'varchar', length: '16' },
            { name: 'artifactId', type: 'varchar', length: '36' },
            { name: 'version', type: 'integer' },
            { name: 'anchorKind', type: 'varchar', length: '8' },
            { name: 'anchorStart', type: 'integer', ...nullable },
            { name: 'anchorEnd', type: 'integer', ...nullable },
            { name: 'anchorQuote', type: 'text', ...nullable },
            { name: 'anchorPrefix', type: 'varchar', length: '32', ...nullable },
            { name: 'anchorSuffix', type: 'varchar', length: '32', ...nullable },
            { name: 'anchorBlockId', type: 'varchar', length: '64', ...nullable },
            { name: 'status', type: 'varchar', length: '16' },
            { name: 'statusVersion', type: 'integer' },
            { name: 'createdBy', type: 'integer' },
            ...author,
            { name: 'createdAt', type: 'varchar', length: '32' },
            { name: 'resolvedBy', type: 'integer', ...nullable },
            { name: 'resolvedAt', type: 'varchar', length: '32', ...nullable },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_artifact_comment_thread_artifact',
              columnNames: ['artifactKind', 'artifactId', 'version'],
            }),
          ],
        }),
      );
    if (!(await runner.hasTable('artifact_comment')))
      await runner.createTable(
        new Table({
          name: 'artifact_comment',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'threadId', type: 'varchar', length: '36' },
            { name: 'authorId', type: 'integer' },
            ...author,
            { name: 'body', type: 'text' },
            { name: 'createdAt', type: 'varchar', length: '32' },
          ],
          indices: [
            new TableIndex({ name: 'IDX_artifact_comment_threadId', columnNames: ['threadId'] }),
          ],
          foreignKeys: [restrictThread('FK_artifact_comment_thread')],
        }),
      );
    if (!(await runner.hasTable('artifact_suggestion')))
      await runner.createTable(
        new Table({
          name: 'artifact_suggestion',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'threadId', type: 'varchar', length: '36' },
            { name: 'artifactId', type: 'varchar', length: '36' },
            { name: 'baseVersion', type: 'integer' },
            { name: 'anchorStart', type: 'integer' },
            { name: 'anchorEnd', type: 'integer' },
            { name: 'anchorQuote', type: 'text' },
            { name: 'anchorPrefix', type: 'varchar', length: '32' },
            { name: 'anchorSuffix', type: 'varchar', length: '32' },
            { name: 'replacement', type: 'text' },
            { name: 'rationale', type: 'text', ...nullable },
            { name: 'status', type: 'varchar', length: '16' },
            { name: 'statusVersion', type: 'integer' },
            { name: 'createdBy', type: 'integer' },
            ...author,
            { name: 'createdAt', type: 'varchar', length: '32' },
            { name: 'decidedBy', type: 'integer', ...nullable },
            { name: 'decidedAt', type: 'varchar', length: '32', ...nullable },
            { name: 'appliedVersion', type: 'integer', ...nullable },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_artifact_suggestion_artifact',
              columnNames: ['artifactId', 'status'],
            }),
          ],
          foreignKeys: [restrictThread('FK_artifact_suggestion_thread')],
        }),
      );
    if (!(await runner.hasTable('artifact_comment_receipt')))
      await runner.createTable(
        new Table({
          name: 'artifact_comment_receipt',
          columns: [
            { name: 'actorId', type: 'integer', isPrimary: true },
            { name: 'organizationKey', type: 'integer', isPrimary: true },
            { name: 'requestId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'operation', type: 'varchar', length: '32' },
            { name: 'payloadHash', type: 'varchar', length: '64' },
            { name: 'resultId', type: 'varchar', length: '36' },
            { name: 'createdAt', type: 'varchar', length: '32' },
          ],
        }),
      );
    if (await runner.hasTable('private_report_delivery_receipt'))
      for (const column of [
        { name: 'aiGrantId', type: 'varchar', length: '36', ...nullable },
        { name: 'aiClientName', type: 'varchar', length: '100', ...nullable },
      ])
        if (!(await runner.hasColumn('private_report_delivery_receipt', column.name)))
          await runner.addColumn('private_report_delivery_receipt', new TableColumn(column));
  }

  async down(): Promise<void> {
    throw new Error('artifact comment rollback requires a reviewed backup plan.');
  }
}
