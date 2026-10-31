import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('mcp_oauth_pending')
export class McpOAuthPending {
  @PrimaryColumn({ length: 64 }) ticketHash: string;
  @Column({ length: 64 }) browserHash: string;
  @Column({ length: 255 }) clientId: string;
  @Column({ type: 'text' }) redirectUri: string;
  @Column({ length: 512 }) state: string;
  @Column({ length: 43 }) codeChallenge: string;
  @Column({ type: 'simple-json' }) scopes: string[];
  @Column({ type: 'text' }) resource: string;
  @Column({ length: 64 }) configFingerprint: string;
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
  })
  expiresAt: Date;
  @Column({ length: 16, default: 'pending' }) status: 'pending' | 'approved' | 'cancelled';
}

@Entity('mcp_oauth_grant')
@Index('IDX_mcp_oauth_grant_actor', ['actorId', 'organizationId'])
export class McpOAuthGrant {
  @PrimaryColumn({ length: 36 }) id: string;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer' }) authVersion: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ length: 255 }) clientId: string;
  @Column({ length: 255 }) clientName: string;
  @Column({ length: 64 }) configFingerprint: string;
  @Column({ type: 'text' }) resource: string;
  @Column({ type: 'simple-json' }) scopes: string[];
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
  })
  createdAt: Date;
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
  })
  expiresAt: Date;
  @Column({ type: 'boolean', default: false }) revoked: boolean;
}

@Entity('mcp_oauth_code')
export class McpOAuthCode {
  @PrimaryColumn({ length: 64 }) codeHash: string;
  @Index('IDX_mcp_oauth_code_grant') @Column({ length: 36 }) grantId: string;
  @Column({ type: 'text' }) redirectUri: string;
  @Column({ length: 43 }) codeChallenge: string;
  @Column({ length: 4 }) codeChallengeMethod: string;
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
  })
  expiresAt: Date;
  @Column({ type: 'boolean', default: false }) consumed: boolean;
}

@Entity('mcp_oauth_token')
export class McpOAuthToken {
  @PrimaryColumn({ length: 64 }) tokenHash: string;
  @Index('IDX_mcp_oauth_token_grant') @Column({ length: 36 }) grantId: string;
  @Column({ type: 'text' }) resource: string;
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
  })
  expiresAt: Date;
}

export const MCP_OAUTH_ENTITIES = [McpOAuthPending, McpOAuthGrant, McpOAuthCode, McpOAuthToken];
