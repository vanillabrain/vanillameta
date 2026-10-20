import { MigrationInterface, QueryRunner, Table, TableColumnOptions } from 'typeorm';

/** Additive metadata consent only. Existing incompatible tables stop without rewriting data. */
export class AddHandoverProposal1792600000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    const columns: TableColumnOptions[] = [
      { name: 'requestId', type: 'varchar', length: '36', isPrimary: true },
      ...[
        'organizationId',
        'ownerId',
        'recipientId',
        'ownerAuthVersion',
        'recipientAuthVersion',
        'organizationVersion',
        'version',
        'createdAuditId',
      ].map(name => ({ name, type: 'integer' })),
      { name: 'acceptedAuditId', type: 'integer', isNullable: true },
      { name: 'cancelledAuditId', type: 'integer', isNullable: true },
      { name: 'status', type: 'varchar', length: '16' },
      { name: 'expiresAt', type: 'datetime' },
      { name: 'acceptedAt', type: 'datetime', isNullable: true },
      { name: 'manifestJson', type: 'text' },
      { name: 'payloadHash', type: 'varchar', length: '64' },
      { name: 'reviewBasis', type: 'varchar', length: '64' },
    ];
    if (await runner.hasTable('enterprise_handover_proposal')) {
      const table = await runner.getTable('enterprise_handover_proposal');
      if (
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
        throw new Error('Handover proposal schema preflight stopped: incompatible existing table');
      return;
    }
    await runner.createTable(new Table({ name: 'enterprise_handover_proposal', columns }));
  }
  async down(): Promise<void> {
    throw new Error('Handover proposal rollback requires a reviewed retention plan');
  }
}
