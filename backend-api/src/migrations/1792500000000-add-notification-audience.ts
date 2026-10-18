import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddNotificationAudience1792500000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('enterprise_notification_audience')))
      await runner.createTable(
        new Table({
          name: 'enterprise_notification_audience',
          columns: ['eventId', 'recipientId'].map(name => ({
            name,
            type: 'integer',
            isPrimary: true,
          })),
          indices: [
            new TableIndex({
              name: 'IDX_enterprise_notification_audience_recipient',
              columnNames: ['recipientId', 'eventId'],
            }),
          ],
        }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Notification audience rollback requires a reviewed backup plan.');
  }
}
