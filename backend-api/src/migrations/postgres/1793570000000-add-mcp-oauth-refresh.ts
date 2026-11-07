import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

const nullable = { isNullable: true };

/**
 * Rotating refresh tokens bound to a remote MCP OAuth grant (McpOAuthRefresh in
 * mcp-oauth.entities.ts). Column order and types match the entity, so an upgraded database and a
 * fresh bootstrap (entity synchronization) produce the same schema.
 */
export class AddMcpOAuthRefresh1793570000000 implements MigrationInterface {
  name = 'AddMcpOAuthRefresh1793570000000';

  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('mcp_oauth_refresh')) return;
    await runner.createTable(
      new Table({
        name: 'mcp_oauth_refresh',
        columns: [
          { name: 'tokenHash', type: 'varchar', length: '64', isPrimary: true },
          { name: 'grantId', type: 'varchar', length: '36' },
          { name: 'clientId', type: 'varchar', length: '255' },
          { name: 'resource', type: 'text' },
          { name: 'accessHash', type: 'varchar', length: '64' },
          { name: 'rotation', type: 'integer' },
          { name: 'parentHash', type: 'varchar', length: '64', ...nullable },
          { name: 'replacedByHash', type: 'varchar', length: '64', ...nullable },
          { name: 'state', type: 'varchar', length: '12', default: "'active'" },
          { name: 'issuedAt', type: 'timestamp' },
          { name: 'expiresAt', type: 'timestamp' },
          { name: 'usedAt', type: 'timestamp', ...nullable },
          { name: 'retriedAt', type: 'timestamp', ...nullable },
        ],
        indices: [
          new TableIndex({ name: 'IDX_mcp_oauth_refresh_grant', columnNames: ['grantId'] }),
        ],
      }),
    );
  }

  async down(): Promise<void> {
    throw new Error('MCP OAuth refresh rollback requires a reviewed backup plan.');
  }
}
