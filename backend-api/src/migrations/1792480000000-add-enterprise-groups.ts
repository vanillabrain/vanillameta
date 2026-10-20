import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
export class AddEnterpriseGroups1792480000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    if (!(await r.hasTable('enterprise_group')))
      await r.createTable(
        new Table({
          name: 'enterprise_group',
          columns: [
            {
              name: 'id',
              type: 'integer',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'organizationId', type: 'integer' },
            { name: 'name', type: 'varchar', length: '100' },
            { name: 'nameKey', type: 'varchar', length: '100' },
            { name: 'active', type: 'boolean', default: true },
            { name: 'version', type: 'integer' },
          ],
          indices: [
            new TableIndex({
              name: 'UQ_enterprise_group_name',
              columnNames: ['organizationId', 'nameKey'],
              isUnique: true,
            }),
          ],
        }),
      );
    if (!(await r.hasTable('enterprise_group_member')))
      await r.createTable(
        new Table({
          name: 'enterprise_group_member',
          columns: [
            { name: 'groupId', type: 'integer', isPrimary: true },
            { name: 'userId', type: 'integer', isPrimary: true },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_enterprise_group_member_user',
              columnNames: ['userId', 'groupId'],
            }),
          ],
        }),
      );
    if (!(await r.hasTable('enterprise_group_grant')))
      await r.createTable(
        new Table({
          name: 'enterprise_group_grant',
          columns: [
            { name: 'resourceKind', type: 'varchar', length: '16', isPrimary: true },
            { name: 'resourceId', type: 'integer', isPrimary: true },
            { name: 'groupId', type: 'integer', isPrimary: true },
            ...['organizationId', 'ownerId', 'version'].map(name => ({ name, type: 'integer' })),
            ...['read', 'edit', 'publish', 'export'].map(name => ({
              name,
              type: 'boolean',
              default: false,
            })),
          ],
          indices: [
            new TableIndex({
              name: 'IDX_enterprise_group_grant_group',
              columnNames: ['groupId', 'organizationId'],
            }),
          ],
        }),
      );
    if (!(await r.hasTable('enterprise_group_request')))
      await r.createTable(
        new Table({
          name: 'enterprise_group_request',
          columns: [
            { name: 'actorId', type: 'integer', isPrimary: true },
            { name: 'requestId', type: 'varchar', length: '36', isPrimary: true },
            { name: 'organizationId', type: 'integer' },
            { name: 'payloadHash', type: 'varchar', length: '64' },
            { name: 'groupId', type: 'integer' },
          ],
        }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Group rollback requires a reviewed backup plan.');
  }
}
