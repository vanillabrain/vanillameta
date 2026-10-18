import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/** Additive consent table only; never rewrites accounts, ownership or memberships. */
export class AddStaffTransfer1792590000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('enterprise_staff_transfer')) {
      const table = await runner.getTable('enterprise_staff_transfer');
      const required = [
        'userId',
        'sourceOrganizationId',
        'targetOrganizationId',
        'authVersion',
        'codeHash',
        'expiresAt',
        'acceptedBy',
        'acceptedEpoch',
        'targetVersion',
        'team',
        'completed',
      ];
      const integer = (type: string) => ['int', 'integer'].includes(type.toLowerCase());
      const nullable = new Set(['acceptedBy', 'acceptedEpoch', 'targetVersion']);
      const normalizedDefault = (value: unknown) =>
        String(value ?? '')
          .replace(/[()'"\s]/g, '')
          .toLowerCase();
      const incompatible = required.some(name => {
        const c = table.findColumnByName(name);
        if (!c || c.isNullable !== nullable.has(name) || c.isGenerated) return true;
        if (name === 'codeHash' || name === 'team')
          return (
            c.type.toLowerCase() !== 'varchar' ||
            c.length !== (name === 'codeHash' ? '64' : '100') ||
            (name === 'team' &&
              (c.default === undefined ||
                c.default === null ||
                normalizedDefault(c.default) !== ''))
          );
        if (name === 'expiresAt') return c.type.toLowerCase() !== 'datetime';
        if (name === 'completed')
          return (
            !['tinyint', 'boolean'].includes(c.type.toLowerCase()) ||
            !['0', 'false'].includes(normalizedDefault(c.default))
          );
        return !integer(c.type) || c.unsigned;
      });
      if (
        incompatible ||
        table.primaryColumns.length !== 1 ||
        table.primaryColumns[0].name !== 'userId' ||
        !table.indices.some(
          i => i.isUnique && i.columnNames.length === 1 && i.columnNames[0] === 'codeHash',
        )
      )
        throw new Error('Staff transfer schema preflight stopped: incompatible existing table');
      return;
    }
    const mysql = ['mysql', 'mariadb'].includes(runner.connection.options.type);
    await runner.createTable(
      new Table({
        name: 'enterprise_staff_transfer',
        columns: [
          { name: 'userId', type: 'integer', isPrimary: true },
          ...['sourceOrganizationId', 'targetOrganizationId', 'authVersion'].map(name => ({
            name,
            type: 'integer',
          })),
          { name: 'codeHash', type: 'varchar', length: '64' },
          { name: 'expiresAt', type: 'datetime' },
          ...['acceptedBy', 'acceptedEpoch', 'targetVersion'].map(name => ({
            name,
            type: 'integer',
            isNullable: true,
          })),
          { name: 'team', type: 'varchar', length: '100', default: "''" },
          { name: 'completed', type: mysql ? 'tinyint' : 'boolean', default: '0' },
        ],
        indices: [
          { name: 'UQ_enterprise_staff_transfer_code', columnNames: ['codeHash'], isUnique: true },
        ],
      }),
    );
  }
  async down(): Promise<void> {
    throw new Error('Staff transfer rollback requires a reviewed retention plan');
  }
}
