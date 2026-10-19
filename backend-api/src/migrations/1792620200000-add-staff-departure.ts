import { MigrationInterface, QueryRunner, Table, TableColumnOptions } from 'typeorm';

/** Additive metadata consent only. Existing incompatible tables stop without rewriting data. */
export class AddStaffDeparture1792620200000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    const columns: TableColumnOptions[] = [
      { name: 'requestId', type: 'varchar', length: '36', isPrimary: true },
      ...[
        'userId',
        'organizationId',
        'authVersion',
        'organizationVersion',
        'version',
        'requestedAuditId',
      ].map(name => ({ name, type: 'integer' })),
      ...['completedBy', 'completeOrganizationVersion', 'completedAuditId', 'cancelledAuditId'].map(
        name => ({ name, type: 'integer', isNullable: true }),
      ),
      { name: 'status', type: 'varchar', length: '16' },
      ...['requestedAt', 'expiresAt'].map(name => ({ name, type: 'datetime' })),
      ...['completedAt', 'cancelledAt'].map(name => ({ name, type: 'datetime', isNullable: true })),
      { name: 'payloadHash', type: 'varchar', length: '64' },
      { name: 'completePayloadHash', type: 'varchar', length: '64', isNullable: true },
    ];
    if (await runner.hasTable('enterprise_staff_departure')) {
      const table = await runner.getTable('enterprise_staff_departure');
      if (
        table.columns.length !== columns.length ||
        table.primaryColumns.length !== 1 ||
        table.primaryColumns[0].name !== 'requestId' ||
        columns.some(expected => {
          const actual = table.findColumnByName(expected.name);
          return (
            !actual ||
            actual.isGenerated ||
            actual.isNullable !== !!expected.isNullable ||
            actual.isPrimary !== !!expected.isPrimary ||
            actual.unsigned ||
            (expected.type === 'integer'
              ? !['int', 'integer'].includes(actual.type.toLowerCase())
              : actual.type.toLowerCase() !== expected.type) ||
            (expected.length && actual.length !== expected.length) ||
            (actual.default !== undefined && actual.default !== null)
          );
        })
      )
        throw new Error('Staff departure schema preflight stopped: incompatible existing table');
      return;
    }
    await runner.createTable(
      new Table({
        name: 'enterprise_staff_departure',
        columns,
        indices: [{ name: 'IDX_staff_departure_user', columnNames: ['userId', 'status'] }],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Staff departure rollback requires a reviewed retention plan');
  }
}
