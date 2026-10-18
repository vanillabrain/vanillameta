import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddNotificationState1792450000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('enterprise_notification_state')))
      await runner.createTable(
        new Table({
          name: 'enterprise_notification_state',
          columns: [
            { name: 'recipientId', type: 'integer', isPrimary: true },
            { name: 'eventId', type: 'integer', isPrimary: true },
            { name: 'read', type: 'boolean', default: false },
            { name: 'removed', type: 'boolean', default: false },
          ],
        }),
      );
    const audit = await runner.getTable('enterprise_audit_event');
    if (audit && !audit.indices.some(index => index.name === 'IDX_enterprise_audit_inbox'))
      await runner.createIndex(
        'enterprise_audit_event',
        new TableIndex({
          name: 'IDX_enterprise_audit_inbox',
          columnNames: ['subjectId', 'organizationId', 'id'],
        }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Notification state rollback requires a reviewed backup plan.');
  }
}
