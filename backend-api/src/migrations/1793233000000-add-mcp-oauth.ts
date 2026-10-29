import { MigrationInterface, QueryRunner, Table, TableColumnOptions, TableIndex } from 'typeorm';

export class AddMcpOAuth1793233000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    const varchar = (name: string, length: number): TableColumnOptions => ({
      name,
      type: 'varchar',
      length: String(length),
    });
    const text = (name: string): TableColumnOptions => ({ name, type: 'text' });
    const date = (name: string): TableColumnOptions => ({ name, type: 'datetime' });
    const integer = (name: string): TableColumnOptions => ({ name, type: 'integer' });
    const tables = [
      new Table({
        name: 'mcp_oauth_pending',
        columns: [
          { ...varchar('ticketHash', 64), isPrimary: true },
          varchar('browserHash', 64),
          varchar('clientId', 255),
          text('redirectUri'),
          varchar('state', 512),
          varchar('codeChallenge', 43),
          text('scopes'),
          text('resource'),
          varchar('configFingerprint', 64),
          date('expiresAt'),
          { ...varchar('status', 16), default: "'pending'" },
        ],
      }),
      new Table({
        name: 'mcp_oauth_grant',
        columns: [
          { ...varchar('id', 36), isPrimary: true },
          integer('actorId'),
          integer('authVersion'),
          integer('organizationId'),
          varchar('clientId', 255),
          varchar('clientName', 255),
          varchar('configFingerprint', 64),
          text('resource'),
          text('scopes'),
          date('createdAt'),
          date('expiresAt'),
          { name: 'revoked', type: 'boolean', default: false },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_mcp_oauth_grant_actor',
            columnNames: ['actorId', 'organizationId'],
          }),
        ],
      }),
      new Table({
        name: 'mcp_oauth_code',
        columns: [
          { ...varchar('codeHash', 64), isPrimary: true },
          varchar('grantId', 36),
          text('redirectUri'),
          varchar('codeChallenge', 43),
          varchar('codeChallengeMethod', 4),
          date('expiresAt'),
          { name: 'consumed', type: 'boolean', default: false },
        ],
        indices: [new TableIndex({ name: 'IDX_mcp_oauth_code_grant', columnNames: ['grantId'] })],
      }),
      new Table({
        name: 'mcp_oauth_token',
        columns: [
          { ...varchar('tokenHash', 64), isPrimary: true },
          varchar('grantId', 36),
          text('resource'),
          date('expiresAt'),
        ],
        indices: [new TableIndex({ name: 'IDX_mcp_oauth_token_grant', columnNames: ['grantId'] })],
      }),
    ];
    for (const table of tables)
      if (!(await runner.hasTable(table.name))) await runner.createTable(table);
  }

  async down(): Promise<void> {
    throw new Error('OAuth authorization history rollback requires a reviewed backup plan.');
  }
}
