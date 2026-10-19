import { MigrationInterface, QueryRunner, Table, TableColumnOptions } from 'typeorm';

/** Additive metadata consent only. Existing incompatible tables stop without rewriting data. */
export class AddSourceHandover1792620000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    const columns: TableColumnOptions[] = [
      { name: 'proposalId', type: 'varchar', length: '36', isPrimary: true },
      { name: 'requestId', type: 'varchar', length: '36' },
      ...[
        'organizationId',
        'ownerId',
        'recipientId',
        'ownerAuthVersion',
        'recipientAuthVersion',
        'organizationVersion',
        'version',
        'preparedAuditId',
      ].map(name => ({ name, type: 'integer' })),
      { name: 'acceptedAuditId', type: 'integer', isNullable: true },
      { name: 'completedAuditId', type: 'integer', isNullable: true },
      { name: 'cancelledAuditId', type: 'integer', isNullable: true },
      { name: 'status', type: 'varchar', length: '16' },
      { name: 'expiresAt', type: 'datetime' },
      { name: 'acceptedAt', type: 'datetime', isNullable: true },
      { name: 'completedAt', type: 'datetime', isNullable: true },
      { name: 'manifestJson', type: 'text' },
      { name: 'custodyHash', type: 'varchar', length: '64' },
      { name: 'basisHash', type: 'varchar', length: '64' },
      { name: 'payloadHash', type: 'varchar', length: '64' },
      { name: 'reviewBasis', type: 'varchar', length: '64' },
    ];
    if (await runner.hasTable('enterprise_source_handover')) {
      const table = await runner.getTable('enterprise_source_handover');
      if (
        table.columns.length !== columns.length ||
        table.primaryColumns.length !== 1 ||
        table.primaryColumns[0].name !== 'proposalId' ||
        ![...table.uniques, ...table.indices.filter(i => i.isUnique)].some(
          u => u.columnNames.length === 1 && u.columnNames[0] === 'requestId',
        ) ||
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
        throw new Error('Source handover schema preflight stopped: incompatible existing table');
      return;
    }
    await runner.createTable(
      new Table({
        name: 'enterprise_source_handover',
        columns,
        uniques: [{ name: 'UQ_source_handover_request', columnNames: ['requestId'] }],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Source handover rollback requires a reviewed retention plan');
  }
}
