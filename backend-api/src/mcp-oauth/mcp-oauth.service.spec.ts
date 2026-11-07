// mcp.controller (the .well-known metadata) reaches the AI provider registry through its modules.
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
jest.mock('@ai-sdk/provider', () => ({}));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
import {
  ArgumentsHost,
  HttpException,
  INestApplication,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import supertest = require('supertest');
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  LessThan,
  UpdateEvent,
} from 'typeorm';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { AddMcpOAuth1793233000000 } from '../migrations/1793233000000-add-mcp-oauth';
import { User } from '../user/entities/user.entity';
import {
  MCP_OAUTH_ENTITIES,
  McpOAuthCode,
  McpOAuthGrant,
  McpOAuthPending,
  McpOAuthRefresh,
  McpOAuthToken,
} from './mcp-oauth.entities';
import { MCP_SCOPES } from './config';
import { authorizationMetadata } from './mcp.controller';
import { McpOAuthExceptionFilter } from './mcp-oauth.http';
import { McpOAuthModule } from './mcp-oauth.module';
import {
  MCP_OAUTH_CLEANUP_BATCH,
  MCP_OAUTH_CLEANUP_GRACE_MS,
  McpOAuthService,
} from './mcp-oauth.service';

const api = 'http://127.0.0.1:4444/v1';
const web = 'http://127.0.0.1:3333';
const callback = 'http://127.0.0.1:2222/callback';
const verifier = 'A'.repeat(43);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const actor = { actorId: 1, authVersion: 0 };
const secondActor = { actorId: 2, authVersion: 0 };
const httpTest = process.env.MCP_OAUTH_HTTP_TESTS === '1' ? it : it.skip;
const query = () => ({
  response_type: 'code',
  client_id: 'test-client',
  redirect_uri: callback,
  state: 'original state',
  code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  code_challenge_method: 'S256',
  resource: `${api}/mcp`,
  scope: 'sources:read documents:read',
});

describe('MCP OAuth real SQLite and Nest protocol', () => {
  let db: DataSource;
  let app: INestApplication;
  let service: McpOAuthService;
  let jwt: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CONFIG_SECRET_KEY = 'mcp-test-hmac-secret';
    process.env.ACCESS_SECRET = 'mcp-test-jwt-secret';
    process.env.MCP_PUBLIC_API_URL = api;
    process.env.MCP_PUBLIC_WEB_URL = web;
    process.env.MCP_OAUTH_CLIENTS_JSON = JSON.stringify([
      {
        id: 'test-client',
        name: 'Test client',
        redirectUris: [callback],
        scopes: ['sources:read', 'documents:read'],
      },
    ]);
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, EnterpriseOrganization, EnterpriseMembership, ...MCP_OAUTH_ENTITIES],
          synchronize: true,
        }),
        McpOAuthModule,
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    db = module.get(DataSource);
    service = module.get(McpOAuthService);
    await db.getRepository(User).save([
      {
        id: 1,
        userId: 'actor-one',
        email: 'actor-one@example.test',
        password: 'unused',
        active: true,
        authVersion: 0,
      },
      {
        id: 2,
        userId: 'actor-two',
        email: 'actor-two@example.test',
        password: 'unused',
        active: true,
        authVersion: 0,
      },
    ]);
    await db.getRepository(EnterpriseOrganization).save([
      { id: 1, name: 'First organization' },
      { id: 2, name: 'Second organization' },
    ]);
    await db.getRepository(EnterpriseMembership).save([
      { userId: 1, organizationId: 1, role: 'member' },
      { userId: 2, organizationId: 1, role: 'member' },
    ]);
    jwt = new JwtService().sign(
      { accessKeyData: { id: 1, userId: 'actor-one', authVersion: 0 } },
      { secret: process.env.ACCESS_SECRET },
    );
  });

  afterEach(async () => {
    await app?.close();
    process.env = { ...originalEnv };
  });

  async function pending() {
    const start = await service.authorize(query());
    const ticket = start.redirectUrl.split('/').pop();
    const review = await service.request(actor, ticket, start.browser);
    return { ...start, ticket, review };
  }

  async function approved() {
    const start = await pending();
    const result = await service.decision(actor, start.ticket, start.browser, {
      decision: 'approve',
      reviewToken: start.review.reviewToken,
      scopes: ['sources:read'],
    });
    return { ...start, code: new URL(result.redirectUrl).searchParams.get('code') };
  }

  function exchange(code: string) {
    return {
      grant_type: 'authorization_code',
      code,
      client_id: 'test-client',
      redirect_uri: callback,
      code_verifier: verifier,
      resource: `${api}/mcp`,
    };
  }

  it.each(['epoch', 'configuration', 'organization'])(
    'does not count invalidated %s grants against replacement approval',
    async kind => {
      const first = await approved();
      const token = await service.token(exchange(first.code));
      const old = await db.manager.findOneByOrFail(McpOAuthGrant, { actorId: actor.actorId });
      await db.manager.insert(
        McpOAuthGrant,
        Array.from({ length: 19 }, () => ({ ...old, id: randomUUID() })),
      );
      const current = { ...actor };
      if (kind === 'epoch') {
        current.authVersion = 1;
        await db.manager.update(User, { id: actor.actorId }, { authVersion: 1 });
      } else if (kind === 'configuration') {
        const clients = JSON.parse(process.env.MCP_OAUTH_CLIENTS_JSON);
        clients[0].name = 'New client configuration';
        process.env.MCP_OAUTH_CLIENTS_JSON = JSON.stringify(clients);
      } else {
        await db.manager.update(
          EnterpriseMembership,
          { userId: actor.actorId },
          { organizationId: 2 },
        );
      }
      await expect(service.authenticateBearer(`Bearer ${token.access_token}`)).rejects.toThrow();
      const started = await service.authorize(query());
      const ticket = started.redirectUrl.split('/').pop();
      const review = await service.request(current, ticket, started.browser);
      expect(
        await service.decision(current, ticket, started.browser, {
          decision: 'approve',
          reviewToken: review.reviewToken,
          scopes: ['sources:read'],
        }),
      ).toMatchObject({ approved: true });
      expect(await db.manager.count(McpOAuthGrant)).toBe(21);
    },
  );

  it('still limits twenty current grants', async () => {
    await approved();
    const old = await db.manager.findOneByOrFail(McpOAuthGrant, { actorId: actor.actorId });
    await db.manager.insert(
      McpOAuthGrant,
      Array.from({ length: 19 }, () => ({ ...old, id: randomUUID() })),
    );
    await expect(approved()).rejects.toThrow('Connection limit');
    expect(await db.manager.count(McpOAuthGrant)).toBe(20);
  });

  it('runs the real migration idempotently and persists only secret hashes', async () => {
    const runner = db.createQueryRunner();
    for (const name of [
      'mcp_oauth_token',
      'mcp_oauth_code',
      'mcp_oauth_grant',
      'mcp_oauth_pending',
    ])
      await runner.dropTable(name);
    await new AddMcpOAuth1793233000000().up(runner);
    await new AddMcpOAuth1793233000000().up(runner);
    await runner.release();
    const start = await approved();
    const token = await service.token(exchange(start.code));
    const principal = await service.authenticateBearer(`Bearer ${token.access_token}`);
    await expect(service.revalidate(principal)).resolves.toBeUndefined();
    expect(principal).toEqual({
      grantId: expect.any(String),
      actorId: 1,
      authVersion: 0,
      organizationId: 1,
      clientName: 'Test client',
      scopes: ['sources:read'],
    });
    expect(Object.keys(token).sort()).toEqual([
      'access_token',
      'expires_in',
      'refresh_token',
      'scope',
      'token_type',
    ]);
    expect(token.refresh_token).toMatch(/^[a-f0-9]{64}$/);
    expect(token.expires_in).toBeGreaterThanOrEqual(599);
    expect(token.expires_in).toBeLessThanOrEqual(600);
    const rows = await Promise.all(
      MCP_OAUTH_ENTITIES.map(entity => db.getRepository(entity).find()),
    );
    const stored = JSON.stringify(rows);
    for (const secret of [
      start.ticket,
      start.browser,
      start.code,
      token.access_token,
      token.refresh_token,
      verifier,
    ])
      expect(stored).not.toContain(secret);
    expect(stored).toContain(hash(token.access_token));
    expect(stored).toContain(hash(token.refresh_token));
    expect(
      (await db.getRepository(McpOAuthCode).findOneByOrFail({ codeHash: hash(start.code) }))
        .consumed,
    ).toBe(true);
  });

  it('reads a bound consent context without changing any OAuth rows', async () => {
    const start = await pending();
    const before = JSON.stringify(
      await Promise.all(MCP_OAUTH_ENTITIES.map(entity => db.getRepository(entity).find())),
    );
    expect(await service.request(actor, start.ticket, start.browser)).toEqual(start.review);
    expect(start.review.redirectUri).toBe(callback);
    expect(start.review.organization).toEqual({ id: 1, name: 'First organization' });
    expect(
      JSON.stringify(
        await Promise.all(MCP_OAUTH_ENTITIES.map(entity => db.getRepository(entity).find())),
      ),
    ).toBe(before);
    await expect(service.request(actor, start.ticket, 'f'.repeat(64))).rejects.toThrow();
  });

  it.each([
    { response_type: 'token' },
    { client_id: 'unknown' },
    { redirect_uri: `${callback}/extra` },
    { resource: 'https://attacker.test/mcp' },
    { resource: undefined },
    { code_challenge_method: 'plain' },
    { code_challenge: 'a'.repeat(42) },
    { scope: 'sources:write' },
    { scope: 'sources:read sources:read' },
    { state: '' },
    { state: 'a'.repeat(513) },
    { client_id: ['test-client', 'evil'] },
  ])('rejects authorization query before storing or redirecting: %j', async patch => {
    await expect(service.authorize({ ...query(), ...patch })).rejects.toThrow();
    expect(await db.getRepository(McpOAuthPending).count()).toBe(0);
  });

  it('cancels exactly once with original state and creates no grant or code', async () => {
    const start = await pending();
    const body = { decision: 'cancel', reviewToken: start.review.reviewToken, scopes: [] };
    const result = await service.decision(actor, start.ticket, start.browser, body);
    expect(result.approved).toBe(false);
    const redirect = new URL(result.redirectUrl);
    expect(redirect.origin + redirect.pathname).toBe(callback);
    expect(redirect.searchParams.get('error')).toBe('access_denied');
    expect(redirect.searchParams.get('state')).toBe(query().state);
    expect(await db.getRepository(McpOAuthGrant).count()).toBe(0);
    expect(await db.getRepository(McpOAuthCode).count()).toBe(0);
    await expect(service.decision(actor, start.ticket, start.browser, body)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('allows only one concurrent approval and one concurrent token exchange', async () => {
    const start = await pending();
    const body = {
      decision: 'approve',
      reviewToken: start.review.reviewToken,
      scopes: ['sources:read'],
    };
    const approvals = await Promise.allSettled([
      service.decision(actor, start.ticket, start.browser, body),
      service.decision(actor, start.ticket, start.browser, body),
    ]);
    expect(approvals.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const result = approvals.find(result => result.status === 'fulfilled');
    if (result?.status !== 'fulfilled') throw new Error('Approval missing');
    const code = new URL(result.value.redirectUrl).searchParams.get('code');
    const tokens = await Promise.allSettled([
      service.token(exchange(code)),
      service.token(exchange(code)),
    ]);
    expect(tokens.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.getRepository(McpOAuthToken).count()).toBe(1);
  });

  it.each(['wrong', 'missing', 'invalid'])(
    'persists consumption after %s PKCE failure',
    async kind => {
      const start = await approved();
      const input = exchange(start.code);
      if (kind === 'missing') delete input.code_verifier;
      else input.code_verifier = kind === 'wrong' ? 'B'.repeat(43) : 'invalid';
      await expect(service.token(input)).rejects.toThrow();
      await expect(service.token(exchange(start.code))).rejects.toThrow();
      expect(
        (await db.getRepository(McpOAuthCode).findOneByOrFail({ codeHash: hash(start.code) }))
          .consumed,
      ).toBe(true);
      expect(await db.getRepository(McpOAuthToken).count()).toBe(0);
      // The correct retry proves the verifier, so it is a replay of a consumed code.
      expect((await db.getRepository(McpOAuthGrant).findOneByOrFail({})).revoked).toBe(true);
    },
  );

  it('rejects missing/wrong resource and unknown refresh tokens, then permits the original valid exchange', async () => {
    const start = await approved();
    await expect(
      service.token({ ...exchange(start.code), resource: 'https://other.test/mcp' }),
    ).rejects.toThrow();
    await expect(service.token({ ...exchange(start.code), resource: undefined })).rejects.toThrow();
    for (const refresh_token of ['no-refresh', 'f'.repeat(64)])
      await expect(
        service.token({ grant_type: 'refresh_token', refresh_token, client_id: 'test-client' }),
      ).rejects.toMatchObject({ name: 'invalid_grant' });
    await expect(service.token(exchange(start.code))).resolves.toHaveProperty('refresh_token');
  });

  it('rejects account switching, membership changes, epoch changes and forged review tokens', async () => {
    const start = await pending();
    const body = {
      decision: 'approve',
      reviewToken: start.review.reviewToken,
      scopes: ['sources:read'],
    };
    await expect(
      service.decision(secondActor, start.ticket, start.browser, body),
    ).rejects.toThrow();
    await expect(
      service.decision(actor, start.ticket, start.browser, {
        ...body,
        reviewToken: '0'.repeat(64),
      }),
    ).rejects.toThrow();
    await db.getRepository(EnterpriseMembership).update({ userId: 1 }, { organizationId: 2 });
    await expect(service.decision(actor, start.ticket, start.browser, body)).rejects.toThrow();
    await db.getRepository(EnterpriseMembership).update({ userId: 1 }, { organizationId: 1 });
    await db.getRepository(User).update(1, { authVersion: 1 });
    await expect(
      service.decision({ actorId: 1, authVersion: 1 }, start.ticket, start.browser, body),
    ).rejects.toThrow();
    expect(await db.getRepository(McpOAuthGrant).count()).toBe(0);
  });

  it('binds consent to requested nonempty scopes and accepts no actor input', async () => {
    const start = await pending();
    for (const body of [
      { decision: 'approve', scopes: [] },
      { decision: 'cancel', scopes: ['sources:read'] },
      { decision: 'approve', scopes: ['sources:write'] },
      { decision: 'approve', scopes: ['sources:read'], actorId: 2 },
    ])
      await expect(
        service.decision(actor, start.ticket, start.browser, {
          ...body,
          reviewToken: start.review.reviewToken,
        }),
      ).rejects.toThrow();
    expect(await db.getRepository(McpOAuthCode).count()).toBe(0);
  });

  it('narrows report and comment scopes within the client allowlist', async () => {
    await expect(
      service.authorize({ ...query(), scope: 'sources:read comments:write' }),
    ).rejects.toThrow('Invalid scope');
    await expect(service.authorize({ ...query(), scope: 'a'.repeat(513) })).rejects.toThrow(
      'Invalid authorization request',
    );
    const clients = JSON.parse(process.env.MCP_OAUTH_CLIENTS_JSON);
    clients[0].scopes = [...MCP_SCOPES];
    process.env.MCP_OAUTH_CLIENTS_JSON = JSON.stringify(clients);
    const start = await service.authorize({ ...query(), scope: MCP_SCOPES.join(' ') });
    const ticket = start.redirectUrl.split('/').pop();
    const review = await service.request(actor, ticket, start.browser);
    expect(review.requestedScopes).toEqual([...MCP_SCOPES]);
    const result = await service.decision(actor, ticket, start.browser, {
      decision: 'approve',
      reviewToken: review.reviewToken,
      scopes: ['reports:read', 'comments:write'],
    });
    const token = await service.token(
      exchange(new URL(result.redirectUrl).searchParams.get('code')),
    );
    expect(token.scope).toBe('reports:read comments:write');
    const principal = await service.authenticateBearer(`Bearer ${token.access_token}`);
    expect(principal.scopes).toEqual(['reports:read', 'comments:write']);
    expect(service.authorizationMetadata().scopes_supported).toEqual([...MCP_SCOPES]);
  });

  it('checks config fingerprint for approval, code exchange, bearer use and revalidation', async () => {
    const pendingStart = await pending();
    const codeStart = await approved();
    const tokenStart = await approved();
    const token = await service.token(exchange(tokenStart.code));
    const principal = await service.authenticateBearer(`Bearer ${token.access_token}`);
    process.env.MCP_PUBLIC_WEB_URL = 'http://localhost:3333';
    await expect(
      service.decision(actor, pendingStart.ticket, pendingStart.browser, {
        decision: 'approve',
        reviewToken: pendingStart.review.reviewToken,
        scopes: ['sources:read'],
      }),
    ).rejects.toThrow();
    await expect(service.token(exchange(codeStart.code))).rejects.toThrow();
    await expect(service.authenticateBearer(`Bearer ${token.access_token}`)).rejects.toMatchObject({
      status: 401,
    });
    await expect(service.revalidate(principal)).rejects.toMatchObject({ status: 401 });
  });

  it.each(['epoch', 'inactive', 'organization', 'membership', 'grant', 'token', 'resource'])(
    'denies bearer and long-read completion after %s changes',
    async change => {
      const start = await approved();
      const token = await service.token(exchange(start.code));
      const principal = await service.authenticateBearer(`Bearer ${token.access_token}`);
      if (change === 'epoch') await db.getRepository(User).update(1, { authVersion: 1 });
      if (change === 'inactive') await db.getRepository(User).update(1, { active: false });
      if (change === 'organization')
        await db.getRepository(EnterpriseMembership).update(1, { organizationId: 2 });
      if (change === 'membership') await db.getRepository(EnterpriseMembership).delete(1);
      if (change === 'grant')
        await db.getRepository(McpOAuthGrant).update(principal.grantId, { expiresAt: new Date(0) });
      if (change === 'token')
        await db
          .getRepository(McpOAuthToken)
          .update(hash(token.access_token), { expiresAt: new Date(0) });
      if (change === 'resource')
        await db
          .getRepository(McpOAuthToken)
          .update(hash(token.access_token), { resource: 'https://other.test/mcp' });
      await expect(
        service.authenticateBearer(`Bearer ${token.access_token}`),
      ).rejects.toMatchObject({ status: 401 });
      await expect(service.revalidate(principal)).rejects.toMatchObject({ status: 401 });
    },
  );

  it('isolates connection ownership and disconnects idempotently without changing product rows', async () => {
    const start = await approved();
    const token = await service.token(exchange(start.code));
    const principal = await service.authenticateBearer(`Bearer ${token.access_token}`);
    const before = JSON.stringify(await db.getRepository(User).find());
    expect((await service.connections(actor)).connections).toHaveLength(1);
    expect((await service.connections(secondActor)).connections).toEqual([]);
    await expect(service.disconnect(secondActor, principal.grantId, {})).rejects.toMatchObject({
      status: 403,
    });
    await service.disconnect(actor, principal.grantId, {});
    await expect(service.disconnect(actor, principal.grantId, {})).resolves.toEqual({
      revoked: true,
    });
    await expect(service.revalidate(principal)).rejects.toThrow();
    expect(JSON.stringify(await db.getRepository(User).find())).toBe(before);
  });

  it('locks the grant row before the actor row on token exchange, refresh, disconnect and revoke, like MCP writes', async () => {
    // SQLite skips FOR UPDATE, so assert the order of the locking lookups PostgreSQL would run.
    // Only lookups inside a write transaction count: token exchange reads the grant and the user
    // without locks (getAuthorizationCode) before saveToken opens its transaction.
    const lookups: string[] = [];
    const original = EntityManager.prototype.findOne;
    const spy = jest
      .spyOn(EntityManager.prototype, 'findOne')
      .mockImplementation(function (this: EntityManager, target: any, options: any) {
        if (this.queryRunner?.isTransactionActive)
          lookups.push(typeof target === 'function' ? target.name : String(target));
        return original.call(this, target, options);
      } as any);
    try {
      const first = await approved();
      lookups.length = 0;
      const firstToken = await service.token(exchange(first.code));
      expect(lookups.indexOf('McpOAuthGrant')).toBeGreaterThanOrEqual(0);
      expect(lookups.indexOf('User')).toBeGreaterThanOrEqual(0);
      expect(lookups.indexOf('McpOAuthGrant')).toBeLessThan(lookups.indexOf('User'));
      const grantId = (await service.authenticateBearer(`Bearer ${firstToken.access_token}`))
        .grantId;
      lookups.length = 0;
      await service.disconnect(actor, grantId, {});
      expect(lookups.indexOf('McpOAuthGrant')).toBeGreaterThanOrEqual(0);
      expect(lookups.indexOf('McpOAuthGrant')).toBeLessThan(lookups.indexOf('User'));
      const second = await approved();
      const secondToken = await service.token(exchange(second.code));
      lookups.length = 0;
      const refreshed = await service.token({
        grant_type: 'refresh_token',
        refresh_token: secondToken.refresh_token,
        client_id: 'test-client',
      });
      expect(lookups.indexOf('McpOAuthGrant')).toBeGreaterThanOrEqual(0);
      expect(lookups.indexOf('User')).toBeGreaterThanOrEqual(0);
      expect(lookups.indexOf('McpOAuthGrant')).toBeLessThan(lookups.indexOf('User'));
      lookups.length = 0;
      await service.revoke({ token: refreshed.refresh_token, client_id: 'test-client' });
      expect(lookups.indexOf('McpOAuthGrant')).toBeGreaterThanOrEqual(0);
      expect(lookups.indexOf('McpOAuthGrant')).toBeLessThan(lookups.indexOf('User'));
      const third = await approved();
      await service.token(exchange(third.code));
      lookups.length = 0;
      await expect(service.token(exchange(third.code))).rejects.toMatchObject({
        name: 'invalid_grant',
      });
      expect(lookups).toEqual(['McpOAuthGrant', 'User']);
    } finally {
      spy.mockRestore();
    }
  });

  it('revokes the whole grant for matching client and keeps unknown tokens indistinguishable', async () => {
    const start = await approved();
    const token = await service.token(exchange(start.code));
    expect(await service.revoke({ token: 'unknown', client_id: 'test-client' })).toEqual({});
    expect(
      await service.revoke({ token: token.access_token, client_id: 'another-client' }),
    ).toEqual({});
    await expect(service.authenticateBearer(`Bearer ${token.access_token}`)).resolves.toBeDefined();
    expect(await service.revoke({ token: token.access_token, client_id: 'test-client' })).toEqual(
      {},
    );
    await expect(service.authenticateBearer(`Bearer ${token.access_token}`)).rejects.toThrow();
    expect(await service.revoke({ token: token.access_token, client_id: 'test-client' })).toEqual(
      {},
    );
    await expect(service.authenticateBearer(`Bearer ${jwt}`)).rejects.toThrow();
  });

  it('bounds browser pending requests and active grants', async () => {
    const start = await pending();
    await Promise.all(Array.from({ length: 9 }, () => service.authorize(query(), start.browser)));
    await expect(service.authorize(query(), start.browser)).rejects.toMatchObject({ status: 503 });
    expect(await db.getRepository(McpOAuthPending).count()).toBe(10);
    const codeStart = await approved();
    const grant = await db
      .getRepository(McpOAuthGrant)
      .findOneByOrFail({ clientId: 'test-client' });
    for (let i = 1; i < 20; i++)
      await db
        .getRepository(McpOAuthGrant)
        .insert({ ...grant, id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` });
    const other = await pending();
    await expect(
      service.decision(actor, other.ticket, other.browser, {
        decision: 'approve',
        reviewToken: other.review.reviewToken,
        scopes: ['sources:read'],
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.getRepository(McpOAuthGrant).count()).toBe(20);
    await expect(service.token(exchange(codeStart.code))).resolves.toBeDefined();
  });

  it('rejects expired pending requests and expired codes', async () => {
    const start = await pending();
    await db.getRepository(McpOAuthPending).update(hash(start.ticket), { expiresAt: new Date(0) });
    await expect(service.request(actor, start.ticket, start.browser)).rejects.toThrow();
    const approvedStart = await approved();
    await db
      .getRepository(McpOAuthCode)
      .update(hash(approvedStart.code), { expiresAt: new Date(0) });
    await expect(service.token(exchange(approvedStart.code))).rejects.toThrow();
  });

  it.each(['revocation', 'epoch', 'organization', 'inactive', 'config'])(
    'final token storage rejects %s after committed code consumption',
    async change => {
      const start = await approved();
      const subscriber: EntitySubscriberInterface<McpOAuthCode> = {
        listenTo: () => McpOAuthCode,
        afterUpdate: async (event: UpdateEvent<McpOAuthCode>) => {
          if (!event.entity?.consumed) return;
          const code = await event.manager.findOneByOrFail(McpOAuthCode, {
            codeHash: hash(start.code),
          });
          if (change === 'revocation')
            await event.manager.update(McpOAuthGrant, code.grantId, { revoked: true });
          if (change === 'epoch') await event.manager.update(User, 1, { authVersion: 1 });
          if (change === 'organization')
            await event.manager.update(EnterpriseMembership, 1, { organizationId: 2 });
          if (change === 'inactive') await event.manager.update(User, 1, { active: false });
          if (change === 'config') process.env.MCP_PUBLIC_WEB_URL = 'http://localhost:3333';
        },
      };
      db.subscribers.push(subscriber);
      try {
        await expect(service.token(exchange(start.code))).rejects.toMatchObject({
          name: 'invalid_grant',
        });
        expect(
          (await db.getRepository(McpOAuthCode).findOneByOrFail({ codeHash: hash(start.code) }))
            .consumed,
        ).toBe(true);
        expect(await db.getRepository(McpOAuthToken).count()).toBe(0);
      } finally {
        db.subscribers.splice(db.subscribers.indexOf(subscriber), 1);
      }
    },
  );

  async function seedPendingRows(
    ticket: string,
    count: number,
    status: 'pending' | 'approved' | 'cancelled',
    expiresAt: Date,
  ) {
    await db.query(
      `INSERT INTO mcp_oauth_pending
      (ticketHash, browserHash, clientId, redirectUri, state, codeChallenge, scopes, resource, configFingerprint, expiresAt, status)
      WITH RECURSIVE sequence(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM sequence WHERE n < ?)
      SELECT printf('%064x', n), printf('%064x', n), clientId, redirectUri, state, codeChallenge, scopes, resource, configFingerprint, ?, ?
      FROM sequence CROSS JOIN mcp_oauth_pending WHERE ticketHash = ?`,
      [count, expiresAt.toISOString().replace('T', ' ').replace('Z', ''), status, hash(ticket)],
    );
  }

  it('admits new requests past 10000 historical decisions without deleting history', async () => {
    const start = await approved();
    await seedPendingRows(start.ticket, 10_000, 'cancelled', new Date(0));
    await expect(service.authorize(query())).resolves.toBeDefined();
    expect(await db.getRepository(McpOAuthPending).countBy({ status: 'cancelled' })).toBe(10_000);
    expect(await db.getRepository(McpOAuthPending).countBy({ status: 'approved' })).toBe(1);
  });

  it('recovers expired capacity in batches of 500 while preserving live requests and other records', async () => {
    const start = await approved();
    await service.token(exchange(start.code));
    const live = await pending();
    const preserved = [
      User,
      EnterpriseMembership,
      EnterpriseOrganization,
      McpOAuthCode,
      McpOAuthGrant,
      McpOAuthToken,
    ];
    const before = await Promise.all(preserved.map(entity => db.getRepository(entity).find()));
    const now = new Date();
    await seedPendingRows(start.ticket, 10_000, 'pending', now);
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    try {
      await expect(service.authorize(query())).resolves.toBeDefined();
      expect(await db.getRepository(McpOAuthPending).count()).toBe(9503);
      await expect(service.authorize(query())).resolves.toBeDefined();
      expect(await db.getRepository(McpOAuthPending).count()).toBe(9004);
      await expect(service.request(actor, live.ticket, live.browser)).resolves.toEqual(live.review);
      expect(
        await db.getRepository(McpOAuthPending).findOneBy({ ticketHash: hash(start.ticket) }),
      ).toMatchObject({ status: 'approved' });
      expect(await Promise.all(preserved.map(entity => db.getRepository(entity).find()))).toEqual(
        before,
      );
    } finally {
      clock.mockRestore();
    }
  });

  it('caps live pending requests at 1000 under concurrent admission and recovers after expiry', async () => {
    const start = await pending();
    await seedPendingRows(start.ticket, 998, 'pending', new Date(Date.now() + 60_000));
    const results = await Promise.allSettled([
      service.authorize(query()),
      service.authorize(query()),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({
      reason: { status: 503 },
    });
    expect(await db.getRepository(McpOAuthPending).count()).toBe(1000);
    await db.getRepository(McpOAuthPending).update(hash(start.ticket), { expiresAt: new Date(0) });
    await expect(service.authorize(query())).resolves.toBeDefined();
    expect(await db.getRepository(McpOAuthPending).count()).toBe(1000);
  });

  it('rejects an allowed scope that was not in the original request', async () => {
    const start = await service.authorize({ ...query(), scope: 'sources:read' });
    const ticket = start.redirectUrl.split('/').pop();
    const review = await service.request(actor, ticket, start.browser);
    await expect(
      service.decision(actor, ticket, start.browser, {
        decision: 'approve',
        reviewToken: review.reviewToken,
        scopes: ['documents:read'],
      }),
    ).rejects.toThrow();
    expect(await db.getRepository(McpOAuthGrant).count()).toBe(0);
  });

  it('returns disabled and no-organization list states without changing user records', async () => {
    delete process.env.MCP_OAUTH_CLIENTS_JSON;
    expect(await service.connections(actor)).toMatchObject({
      configured: false,
      resourceUrl: null,
      connections: [],
    });
    await db.getRepository(EnterpriseMembership).delete(1);
    expect(await service.connections(actor)).toMatchObject({
      configured: false,
      organization: null,
      connections: [],
    });
  });

  describe('refresh_token grant', () => {
    const refreshBody = (refresh_token: string, patch: Record<string, unknown> = {}) => ({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: 'test-client',
      resource: `${api}/mcp`,
      ...patch,
    });
    const refresh = (refresh_token: string, patch: Record<string, unknown> = {}) =>
      service.token(refreshBody(refresh_token, patch));
    const row = (token: string) =>
      db.getRepository(McpOAuthRefresh).findOneByOrFail({ tokenHash: hash(token) });
    const grantOf = async (token: string) =>
      db.getRepository(McpOAuthGrant).findOneByOrFail({ id: (await row(token)).grantId });
    const active = async (grantId: string) =>
      db.getRepository(McpOAuthRefresh).findBy({ grantId, state: 'active' });
    const usedAgo = (token: string, ms: number) =>
      db.getRepository(McpOAuthRefresh).update(hash(token), { usedAt: new Date(Date.now() - ms) });
    async function connected() {
      const start = await approved();
      return service.token(exchange(start.code));
    }

    it('rotates into a new pair on the same grant, one active token per grant', async () => {
      const first = await connected();
      const initial = await row(first.refresh_token);
      expect(initial).toMatchObject({
        rotation: 0,
        state: 'active',
        parentHash: null,
        accessHash: hash(first.access_token),
        clientId: 'test-client',
        resource: `${api}/mcp`,
      });
      expect(initial.expiresAt).toEqual((await grantOf(first.refresh_token)).expiresAt);
      const second = await refresh(first.refresh_token);
      expect(Object.keys(second).sort()).toEqual([
        'access_token',
        'expires_in',
        'refresh_token',
        'scope',
        'token_type',
      ]);
      expect(second).toMatchObject({ token_type: 'Bearer', scope: 'sources:read' });
      expect(second.expires_in).toBeGreaterThanOrEqual(599);
      expect(second.expires_in).toBeLessThanOrEqual(600);
      expect(second.refresh_token).not.toBe(first.refresh_token);
      expect(await row(first.refresh_token)).toMatchObject({
        state: 'rotated',
        usedAt: expect.any(Date),
        retriedAt: null,
        replacedByHash: hash(second.refresh_token),
      });
      expect(await row(second.refresh_token)).toMatchObject({
        state: 'active',
        rotation: 1,
        parentHash: hash(first.refresh_token),
        accessHash: hash(second.access_token),
      });
      const third = await refresh(second.refresh_token);
      expect((await row(third.refresh_token)).rotation).toBe(2);
      const principal = await service.authenticateBearer(`Bearer ${third.access_token}`);
      expect(principal.scopes).toEqual(['sources:read']);
      expect(await active(principal.grantId)).toHaveLength(1);
      expect((await grantOf(third.refresh_token)).revoked).toBe(false);
    });

    it('revokes the grant when a rotated token is reused outside the window', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const first = await connected();
        const second = await refresh(first.refresh_token);
        await usedAgo(first.refresh_token, 31_000);
        await expect(refresh(first.refresh_token)).rejects.toMatchObject({
          name: 'invalid_grant',
        });
        // The revocation committed although the request failed.
        expect((await grantOf(first.refresh_token)).revoked).toBe(true);
        await expect(
          service.authenticateBearer(`Bearer ${second.access_token}`),
        ).rejects.toMatchObject({ status: 401 });
        await expect(refresh(second.refresh_token)).rejects.toMatchObject({
          name: 'invalid_grant',
        });
        expect(warn).toHaveBeenCalledTimes(1);
        const message = String(warn.mock.calls[0][0]);
        expect(message).toContain('reuse');
        expect(message).toContain('"rotation":0');
        expect(message).toContain('"actorId":1');
        for (const secret of [first, second].flatMap(t => [t.access_token, t.refresh_token]))
          expect(message).not.toContain(secret);
        expect(message).not.toContain(hash(first.refresh_token));
      } finally {
        warn.mockRestore();
      }
    });

    it('re-rotates once inside the window, keeps usedAt, and drops the superseded access token', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const first = await connected();
        const second = await refresh(first.refresh_token);
        await usedAgo(first.refresh_token, 29_000);
        const usedAt = (await row(first.refresh_token)).usedAt;
        const retry = await refresh(first.refresh_token);
        expect(await row(first.refresh_token)).toMatchObject({
          state: 'rotated',
          usedAt,
          retriedAt: expect.any(Date),
          replacedByHash: hash(retry.refresh_token),
        });
        expect((await row(second.refresh_token)).state).toBe('superseded');
        expect(await row(retry.refresh_token)).toMatchObject({ state: 'active', rotation: 1 });
        expect(
          await db.getRepository(McpOAuthToken).countBy({ tokenHash: hash(second.access_token) }),
        ).toBe(0);
        await expect(
          service.authenticateBearer(`Bearer ${second.access_token}`),
        ).rejects.toMatchObject({ status: 401 });
        const principal = await service.authenticateBearer(`Bearer ${retry.access_token}`);
        expect(await active(principal.grantId)).toHaveLength(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('retry window');
        expect(String(warn.mock.calls[0][0])).toContain(principal.grantId);
        // A second retry of the same parent is reuse.
        await expect(refresh(first.refresh_token)).rejects.toMatchObject({
          name: 'invalid_grant',
        });
        expect((await grantOf(first.refresh_token)).revoked).toBe(true);
        await expect(
          service.authenticateBearer(`Bearer ${retry.access_token}`),
        ).rejects.toMatchObject({ status: 401 });
      } finally {
        warn.mockRestore();
      }
    });

    it('treats a superseded token as reuse', async () => {
      const first = await connected();
      const second = await refresh(first.refresh_token);
      const retry = await refresh(first.refresh_token);
      await expect(refresh(second.refresh_token)).rejects.toMatchObject({
        name: 'invalid_grant',
      });
      expect((await grantOf(first.refresh_token)).revoked).toBe(true);
      await expect(refresh(retry.refresh_token)).rejects.toMatchObject({ name: 'invalid_grant' });
    });

    it('treats a retry after the successor was used as reuse', async () => {
      const first = await connected();
      const second = await refresh(first.refresh_token);
      await refresh(second.refresh_token);
      await expect(refresh(first.refresh_token)).rejects.toMatchObject({
        name: 'invalid_grant',
      });
      expect((await grantOf(first.refresh_token)).revoked).toBe(true);
    });

    it('treats a usedAt in the future (clock or timezone skew) as reuse, never inside the window', async () => {
      const first = await connected();
      await refresh(first.refresh_token);
      await usedAgo(first.refresh_token, -10_000);
      await expect(refresh(first.refresh_token)).rejects.toMatchObject({
        name: 'invalid_grant',
      });
      expect((await grantOf(first.refresh_token)).revoked).toBe(true);
    });

    it('lets one of two concurrent uses re-rotate and keeps exactly one active token', async () => {
      const first = await connected();
      const results = await Promise.allSettled([
        refresh(first.refresh_token),
        refresh(first.refresh_token),
      ]);
      expect(results.map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
      const tokens = results.map(result => (result.status === 'fulfilled' ? result.value : null));
      const states = await Promise.all(tokens.map(token => row(token.refresh_token)));
      expect(states.map(state => state.state).sort()).toEqual(['active', 'superseded']);
      expect(await active(states[0].grantId)).toHaveLength(1);
      expect((await grantOf(first.refresh_token)).revoked).toBe(false);
      expect(await db.getRepository(McpOAuthToken).countBy({ grantId: states[0].grantId })).toBe(2);
      const third = await Promise.allSettled([
        refresh(tokens.find((_, i) => states[i].state === 'active').refresh_token),
        refresh(tokens.find((_, i) => states[i].state === 'active').refresh_token),
        refresh(tokens.find((_, i) => states[i].state === 'active').refresh_token),
      ]);
      // The third concurrent use is a second retry of the same parent: reuse.
      expect(third.filter(result => result.status === 'rejected')).toHaveLength(1);
      expect((await grantOf(first.refresh_token)).revoked).toBe(true);
    });

    it('bounds tokens by the grant and rejects expired rows without revoking', async () => {
      const first = await connected();
      const grant = await grantOf(first.refresh_token);
      await db
        .getRepository(McpOAuthGrant)
        .update(grant.id, { expiresAt: new Date(Date.now() + 100_000) });
      const second = await refresh(first.refresh_token);
      expect(second.expires_in).toBeLessThanOrEqual(100);
      expect((await row(second.refresh_token)).expiresAt).toEqual(
        (await grantOf(first.refresh_token)).expiresAt,
      );
      await db.getRepository(McpOAuthRefresh).update(hash(second.refresh_token), {
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(refresh(second.refresh_token)).rejects.toMatchObject({
        name: 'invalid_grant',
      });
      expect((await row(second.refresh_token)).state).toBe('active');
      await db.getRepository(McpOAuthRefresh).update(hash(second.refresh_token), {
        expiresAt: grant.expiresAt,
      });
      await db.getRepository(McpOAuthGrant).update(grant.id, { expiresAt: new Date(0) });
      await expect(refresh(second.refresh_token)).rejects.toMatchObject({
        name: 'invalid_grant',
      });
      expect((await grantOf(first.refresh_token)).revoked).toBe(false);
      expect((await row(second.refresh_token)).state).toBe('active');
    });

    it('stops at the rotation cap before any write', async () => {
      const first = await connected();
      await db.getRepository(McpOAuthRefresh).update(hash(first.refresh_token), { rotation: 299 });
      const last = await refresh(first.refresh_token);
      expect((await row(last.refresh_token)).rotation).toBe(300);
      await expect(refresh(last.refresh_token)).rejects.toMatchObject({ name: 'invalid_grant' });
      expect((await row(last.refresh_token)).state).toBe('active');
      expect((await grantOf(last.refresh_token)).revoked).toBe(false);
      expect(await db.getRepository(McpOAuthRefresh).count()).toBe(2);
    });

    it('rejects another client, resource and request shapes without revoking', async () => {
      const clients = JSON.parse(process.env.MCP_OAUTH_CLIENTS_JSON);
      clients.push({ ...clients[0], id: 'other-client', name: 'Other client' });
      process.env.MCP_OAUTH_CLIENTS_JSON = JSON.stringify(clients);
      const first = await connected();
      for (const [patch, name] of [
        [{ client_id: 'other-client' }, 'invalid_grant'],
        [{ client_id: 'unknown-client' }, 'invalid_client'],
        [{ client_id: undefined }, 'invalid_request'],
        [{ resource: 'https://other.test/mcp' }, 'invalid_request'],
        [{ code_verifier: verifier }, 'invalid_request'],
        [{ code: first.refresh_token }, 'invalid_request'],
        [{ refresh_token: [first.refresh_token, first.refresh_token] }, 'invalid_request'],
        [{ refresh_token: first.access_token }, 'invalid_grant'],
        [{ refresh_token: first.refresh_token.toUpperCase() }, 'invalid_grant'],
      ] as const)
        await expect(refresh(first.refresh_token, patch)).rejects.toMatchObject({ name });
      expect((await row(first.refresh_token)).state).toBe('active');
      expect((await grantOf(first.refresh_token)).revoked).toBe(false);
      // resource may be omitted and a harmless redirect_uri is ignored.
      const second = await refresh(first.refresh_token, {
        resource: undefined,
        redirect_uri: callback,
      });
      expect(second.scope).toBe('sources:read');
    });

    it('rejects scope outside the grant and always issues the full grant scope', async () => {
      const first = await connected();
      for (const scope of [
        'sources:read documents:read',
        'documents:read',
        'sources:read sources:read',
        ' sources:read',
      ])
        await expect(refresh(first.refresh_token, { scope })).rejects.toMatchObject({
          name: 'invalid_scope',
        });
      expect((await row(first.refresh_token)).state).toBe('active');
      const second = await refresh(first.refresh_token, { scope: 'sources:read' });
      expect(second.scope).toBe('sources:read');
      // A grant with two scopes is never narrowed by a subset request.
      await db.getRepository(McpOAuthGrant).update((await grantOf(first.refresh_token)).id, {
        scopes: ['sources:read', 'documents:read'],
      });
      const third = await refresh(second.refresh_token, { scope: 'documents:read' });
      expect(third.scope).toBe('sources:read documents:read');
      expect((await service.authenticateBearer(`Bearer ${third.access_token}`)).scopes).toEqual([
        'sources:read',
        'documents:read',
      ]);
    });

    it.each(['epoch', 'inactive', 'organization', 'configuration', 'disconnect', 'revoke'])(
      'answers invalid_grant after %s without treating it as reuse',
      async change => {
        const first = await connected();
        const grant = await grantOf(first.refresh_token);
        if (change === 'epoch') await db.getRepository(User).update(1, { authVersion: 1 });
        if (change === 'inactive') await db.getRepository(User).update(1, { active: false });
        if (change === 'organization')
          await db.getRepository(EnterpriseMembership).update(1, { organizationId: 2 });
        if (change === 'configuration') process.env.MCP_PUBLIC_WEB_URL = 'http://localhost:3333';
        if (change === 'disconnect') await service.disconnect(actor, grant.id, {});
        if (change === 'revoke')
          expect(
            await service.revoke({ token: first.refresh_token, client_id: 'test-client' }),
          ).toEqual({});
        await expect(refresh(first.refresh_token)).rejects.toMatchObject({
          name: 'invalid_grant',
        });
        expect((await row(first.refresh_token)).state).toBe('active');
        expect(await db.getRepository(McpOAuthRefresh).count()).toBe(1);
        expect((await grantOf(first.refresh_token)).revoked).toBe(
          change === 'disconnect' || change === 'revoke',
        );
        await expect(
          service.authenticateBearer(`Bearer ${first.access_token}`),
        ).rejects.toMatchObject({ status: 401 });
      },
    );

    it('answers 5xx, not invalid_grant, when configuration or the database is unavailable', async () => {
      const first = await connected();
      const clients = process.env.MCP_OAUTH_CLIENTS_JSON;
      delete process.env.MCP_OAUTH_CLIENTS_JSON;
      await expect(refresh(first.refresh_token)).rejects.toMatchObject({ status: 503 });
      process.env.MCP_OAUTH_CLIENTS_JSON = clients;
      const original = EntityManager.prototype.findOneBy;
      const failing = jest
        .spyOn(EntityManager.prototype, 'findOneBy')
        .mockImplementation(function (this: EntityManager, target: any, where: any) {
          if (target === McpOAuthRefresh && this.queryRunner?.isTransactionActive)
            return Promise.reject(new Error('canceling statement due to lock timeout'));
          return original.call(this, target, where);
        } as any);
      try {
        const error = await refresh(first.refresh_token).catch(caught => caught);
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.name).not.toBe('invalid_grant');
      } finally {
        failing.mockRestore();
      }
      expect((await row(first.refresh_token)).state).toBe('active');
      await expect(refresh(first.refresh_token)).resolves.toHaveProperty('refresh_token');
    });

    it('uses a shorter non-production access TTL for code exchange and refresh', async () => {
      process.env.MCP_OAUTH_ACCESS_TTL_SECONDS = '120';
      const first = await connected();
      expect(first.expires_in).toBeLessThanOrEqual(120);
      expect(first.expires_in).toBeGreaterThanOrEqual(119);
      const second = await refresh(first.refresh_token);
      expect(second.expires_in).toBeLessThanOrEqual(120);
      process.env.MCP_OAUTH_ACCESS_TTL_SECONDS = '5';
      const clamped = await refresh(second.refresh_token);
      expect(clamped.expires_in).toBeGreaterThanOrEqual(59);
      expect(clamped.expires_in).toBeLessThanOrEqual(60);
    });

    it('advertises refresh_token in both metadata documents', () => {
      expect(service.authorizationMetadata().grant_types_supported).toEqual([
        'authorization_code',
        'refresh_token',
      ]);
      expect(authorizationMetadata()).toEqual(service.authorizationMetadata());
    });
  });

  describe('authorization code replay', () => {
    const grantFor = async (code: string) =>
      db.getRepository(McpOAuthGrant).findOneByOrFail({
        id: (await db.getRepository(McpOAuthCode).findOneByOrFail({ codeHash: hash(code) }))
          .grantId,
      });
    const refreshWith = (refresh_token: string) =>
      service.token({ grant_type: 'refresh_token', refresh_token, client_id: 'test-client' });

    it('revokes the grant when the redeeming client replays the code with its verifier, idempotently', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const start = await approved();
        const issued = await service.token(exchange(start.code));
        await service.authenticateBearer(`Bearer ${issued.access_token}`);
        for (let attempt = 0; attempt < 2; attempt++)
          await expect(service.token(exchange(start.code))).rejects.toMatchObject({
            name: 'invalid_grant',
            message: 'Invalid grant: authorization code is invalid',
          });
        // The revocation committed although the request failed.
        expect((await grantFor(start.code)).revoked).toBe(true);
        await expect(
          service.authenticateBearer(`Bearer ${issued.access_token}`),
        ).rejects.toMatchObject({ status: 401 });
        await expect(refreshWith(issued.refresh_token)).rejects.toMatchObject({
          name: 'invalid_grant',
        });
        expect(warn).toHaveBeenCalledTimes(2);
        expect(String(warn.mock.calls[0][0])).toContain('"revoked":true');
        expect(String(warn.mock.calls[1][0])).toContain('"revoked":false');
        for (const [message] of warn.mock.calls)
          for (const secret of [start.code, hash(start.code), issued.access_token, verifier])
            expect(String(message)).not.toContain(secret);
      } finally {
        warn.mockRestore();
      }
    });

    it('does not revoke on a replay that lacks the verifier, client or redirect_uri of the code', async () => {
      const other = 'http://127.0.0.1:2222/other';
      const clients = JSON.parse(process.env.MCP_OAUTH_CLIENTS_JSON);
      clients[0].redirectUris.push(other);
      clients.push({ ...clients[0], id: 'other-client', name: 'Other client' });
      process.env.MCP_OAUTH_CLIENTS_JSON = JSON.stringify(clients);
      const start = await approved();
      const issued = await service.token(exchange(start.code));
      const unknown = await service
        .token(exchange('e'.repeat(64)))
        .catch((error: Error) => [error.name, error.message]);
      for (const patch of [
        { code_verifier: 'B'.repeat(43) },
        { code_verifier: undefined },
        { code_verifier: 'short' },
        { client_id: 'other-client' },
        { redirect_uri: other },
      ]) {
        const rejected = await service
          .token({ ...exchange(start.code), ...patch })
          .catch((error: Error) => [error.name, error.message]);
        // Indistinguishable from a code that never existed.
        expect(rejected).toEqual(unknown);
      }
      expect((await grantFor(start.code)).revoked).toBe(false);
      await service.authenticateBearer(`Bearer ${issued.access_token}`);
      const refreshed = await refreshWith(issued.refresh_token);
      await expect(service.token(exchange(start.code))).rejects.toMatchObject({
        name: 'invalid_grant',
      });
      expect((await grantFor(start.code)).revoked).toBe(true);
      await expect(
        service.authenticateBearer(`Bearer ${refreshed.access_token}`),
      ).rejects.toMatchObject({ status: 401 });
      await expect(refreshWith(refreshed.refresh_token)).rejects.toMatchObject({
        name: 'invalid_grant',
      });
    });

    it('revokes after a deactivated account or epoch change and still answers invalid_grant', async () => {
      const start = await approved();
      await service.token(exchange(start.code));
      await db.getRepository(User).update(1, { active: false, authVersion: 1 });
      await expect(service.token(exchange(start.code))).rejects.toMatchObject({
        name: 'invalid_grant',
      });
      expect((await grantFor(start.code)).revoked).toBe(true);
    });
  });

  describe('expired row cleanup', () => {
    const old = () => new Date(Date.now() - MCP_OAUTH_CLEANUP_GRACE_MS - 60_000);
    const recent = () => new Date(Date.now() - MCP_OAUTH_CLEANUP_GRACE_MS + 60_000);
    const future = () => new Date(Date.now() + 60 * 60_000);
    const secret = () => hash(randomUUID());

    async function live() {
      const start = await approved();
      const issued = await service.token(exchange(start.code));
      const code = await db
        .getRepository(McpOAuthCode)
        .findOneByOrFail({ codeHash: hash(start.code) });
      const grant = await db.getRepository(McpOAuthGrant).findOneByOrFail({ id: code.grantId });
      const refresh = await db
        .getRepository(McpOAuthRefresh)
        .findOneByOrFail({ tokenHash: hash(issued.refresh_token) });
      return { start, issued, code, grant, refresh };
    }
    async function grantLike(base: McpOAuthGrant, patch: Partial<McpOAuthGrant>) {
      const grant = { ...base, id: randomUUID(), ...patch };
      await db.getRepository(McpOAuthGrant).insert(grant);
      return grant;
    }
    // Single-row inserts: these mixed rows stored misaligned columns as one multi-row SQLite insert.
    async function insertMany<T>(entity: new () => T, rows: T[]) {
      for (const row of rows) await db.getRepository(entity).insert(row as any);
    }
    const tokenRow = (grantId: string, expiresAt: Date): McpOAuthToken => ({
      tokenHash: secret(),
      grantId,
      resource: `${api}/mcp`,
      expiresAt,
    });
    const refreshRow = (base: McpOAuthRefresh, patch: Partial<McpOAuthRefresh>) => ({
      ...base,
      tokenHash: secret(),
      accessHash: secret(),
      ...patch,
    });
    const codeRow = (base: McpOAuthCode, patch: Partial<McpOAuthCode>) => ({
      ...base,
      codeHash: secret(),
      ...patch,
    });
    const exists = async (entity: any, where: object) =>
      (await db.getRepository(entity).countBy(where)) === 1;

    it('deletes only rows past the grace margin, keeps reuse and replay evidence of live grants, never grants', async () => {
      const { issued, code, grant, refresh } = await live();
      const revoked = await grantLike(grant, { revoked: true });
      const expired = await grantLike(grant, { expiresAt: old() });
      const justExpired = await grantLike(grant, { expiresAt: recent() });
      const tokens = {
        old: tokenRow(grant.id, old()),
        recent: tokenRow(grant.id, recent()),
        live: tokenRow(grant.id, future()),
      };
      await insertMany(McpOAuthToken, Object.values(tokens));
      const refreshes = {
        revokedOld: refreshRow(refresh, { grantId: revoked.id, issuedAt: old() }),
        revokedRecent: refreshRow(refresh, { grantId: revoked.id, issuedAt: recent() }),
        expired: refreshRow(refresh, { grantId: expired.id, expiresAt: expired.expiresAt }),
        justExpired: refreshRow(refresh, {
          grantId: justExpired.id,
          expiresAt: justExpired.expiresAt,
        }),
        liveRotated: refreshRow(refresh, { state: 'rotated', issuedAt: old(), usedAt: old() }),
      };
      await insertMany(McpOAuthRefresh, Object.values(refreshes));
      await db.getRepository(McpOAuthCode).update(code.codeHash, { expiresAt: old() });
      const codes = {
        unusedOld: codeRow(code, { consumed: false, expiresAt: old() }),
        unusedRecent: codeRow(code, { consumed: false, expiresAt: recent() }),
        revokedConsumed: codeRow(code, { grantId: revoked.id, expiresAt: old() }),
        expiredConsumed: codeRow(code, { grantId: expired.id, expiresAt: old() }),
        unusedLive: codeRow(code, { consumed: false, expiresAt: future() }),
      };
      await insertMany(McpOAuthCode, Object.values(codes));
      const grantsBefore = await db.getRepository(McpOAuthGrant).find({ order: { id: 'ASC' } });
      const pendingBefore = await db.getRepository(McpOAuthPending).find();

      const next = await service.token({
        grant_type: 'refresh_token',
        refresh_token: issued.refresh_token,
        client_id: 'test-client',
      });

      expect(await exists(McpOAuthToken, { tokenHash: tokens.old.tokenHash })).toBe(false);
      expect(await exists(McpOAuthToken, { tokenHash: tokens.recent.tokenHash })).toBe(true);
      expect(await exists(McpOAuthToken, { tokenHash: tokens.live.tokenHash })).toBe(true);
      expect(await exists(McpOAuthToken, { tokenHash: hash(next.access_token) })).toBe(true);
      const kept = async (row: { tokenHash: string }) =>
        exists(McpOAuthRefresh, { tokenHash: row.tokenHash });
      expect(await kept(refreshes.revokedOld)).toBe(false);
      expect(await kept(refreshes.expired)).toBe(false);
      expect(await kept(refreshes.revokedRecent)).toBe(true);
      expect(await kept(refreshes.justExpired)).toBe(true);
      expect(await kept(refreshes.liveRotated)).toBe(true);
      expect(await kept(refresh)).toBe(true);
      const codeKept = async (row: { codeHash: string }) =>
        exists(McpOAuthCode, { codeHash: row.codeHash });
      expect(await codeKept(code)).toBe(true);
      expect(await codeKept(codes.unusedOld)).toBe(false);
      expect(await codeKept(codes.revokedConsumed)).toBe(false);
      expect(await codeKept(codes.expiredConsumed)).toBe(false);
      expect(await codeKept(codes.unusedRecent)).toBe(true);
      expect(await codeKept(codes.unusedLive)).toBe(true);
      expect(await db.getRepository(McpOAuthGrant).find({ order: { id: 'ASC' } })).toEqual(
        grantsBefore,
      );
      expect(await db.getRepository(McpOAuthPending).find()).toEqual(pendingBefore);
    });

    it('deletes at most 500 rows per table per successful exchange or refresh', async () => {
      const { issued, code, grant, refresh } = await live();
      const revoked = await grantLike(grant, { revoked: true });
      const count = MCP_OAUTH_CLEANUP_BATCH + 100;
      await insertMany(
        McpOAuthToken,
        Array.from({ length: count }, () => tokenRow(grant.id, old())),
      );
      await insertMany(
        McpOAuthRefresh,
        Array.from({ length: count }, () =>
          refreshRow(refresh, { grantId: revoked.id, issuedAt: old() }),
        ),
      );
      await insertMany(
        McpOAuthCode,
        Array.from({ length: count }, () => codeRow(code, { consumed: false, expiresAt: old() })),
      );
      const remaining = async () => [
        await db.getRepository(McpOAuthToken).countBy({ expiresAt: LessThan(recent()) }),
        await db.getRepository(McpOAuthRefresh).countBy({ grantId: revoked.id }),
        await db.getRepository(McpOAuthCode).countBy({ consumed: false }),
      ];
      expect(await remaining()).toEqual([count, count, count]);
      const next = await service.token({
        grant_type: 'refresh_token',
        refresh_token: issued.refresh_token,
        client_id: 'test-client',
      });
      expect(await remaining()).toEqual([100, 100, 100]);
      await service.token({
        grant_type: 'refresh_token',
        refresh_token: next.refresh_token,
        client_id: 'test-client',
      });
      expect(await remaining()).toEqual([0, 0, 0]);
      // A code exchange runs the same cleanup.
      await insertMany(McpOAuthToken, [tokenRow(grant.id, old())]);
      await live();
      expect((await remaining())[0]).toBe(0);
      expect(await db.getRepository(McpOAuthGrant).count()).toBe(3);
    });

    it('logs only the error class and still returns the token when cleanup fails', async () => {
      class CleanupProbeError extends Error {}
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const original = EntityManager.prototype.find;
      const failing = jest
        .spyOn(EntityManager.prototype, 'find')
        .mockImplementation(function (this: EntityManager, target: any, options: any) {
          if (target === McpOAuthToken && this.queryRunner?.isTransactionActive)
            return Promise.reject(new CleanupProbeError('secret detail'));
          return original.call(this, target, options);
        } as any);
      try {
        const { issued, grant } = await live();
        const next = await service.token({
          grant_type: 'refresh_token',
          refresh_token: issued.refresh_token,
          client_id: 'test-client',
        });
        await service.authenticateBearer(`Bearer ${next.access_token}`);
        expect(await db.getRepository(McpOAuthRefresh).countBy({ grantId: grant.id })).toBe(2);
        expect(logged).toHaveBeenCalledTimes(2);
        for (const [message] of logged.mock.calls) {
          expect(String(message)).toContain('"error":"CleanupProbeError"');
          expect(String(message)).not.toContain('secret detail');
        }
      } finally {
        failing.mockRestore();
        logged.mockRestore();
      }
    });
  });

  httpTest(
    'serves OAuth discovery and rejects bad HTTP host/origin without redirects or sensitive errors',
    async () => {
      const http = () => supertest(app.getHttpServer());
      const metadata = await http()
        .get('/v1/mcp-oauth/.well-known/oauth-authorization-server')
        .set('Host', '127.0.0.1:4444')
        .expect(200);
      expect(metadata.headers['cache-control']).toBe('no-store');
      expect(metadata.body).toMatchObject({
        issuer: `${api}/mcp-oauth`,
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256'],
      });
      await http()
        .get('/v1/mcp-oauth/authorize')
        .query(query())
        .set('Host', 'attacker.test')
        .expect(403);
      await http()
        .get('/v1/mcp-oauth/authorize')
        .query(query())
        .set('Host', '127.0.0.1:4444')
        .set('Origin', 'https://attacker.test')
        .expect(403);
      const rejected = await http()
        .get('/v1/mcp-oauth/authorize')
        .query({ ...query(), redirect_uri: 'https://attacker.test/callback' })
        .set('Host', '127.0.0.1:4444')
        .expect(400);
      expect(rejected.headers.location).toBeUndefined();
      expect(rejected.headers['cache-control']).toBe('no-store');
      expect(rejected.body).toEqual({
        error: 'invalid_client',
        error_description: 'Request rejected.',
      });
      expect(await db.getRepository(McpOAuthPending).count()).toBe(0);
    },
  );

  httpTest(
    'completes the real Nest cookie + JWT consent + form token + revoke protocol',
    async () => {
      const http = () => supertest(app.getHttpServer());
      const start = await http()
        .get('/v1/mcp-oauth/authorize')
        .query(query())
        .set('Host', '127.0.0.1:4444')
        .expect(302);
      const cookie = start.headers['set-cookie'][0];
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      const ticket = start.headers.location.split('/').pop();
      const path = `/v1/ai-connections/requests/${ticket}`;
      await http().get(path).set('Host', '127.0.0.1:4444').set('Cookie', cookie).expect(401);
      await http()
        .get(path)
        .set('Host', '127.0.0.1:4444')
        .set('Authorization', `Bearer ${jwt}`)
        .expect(403);
      await http()
        .get(path)
        .set('Host', '127.0.0.1:4444')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Cookie', cookie)
        .set('Origin', 'https://attacker.test')
        .expect(403);
      const review = await http()
        .get(path)
        .set('Host', '127.0.0.1:4444')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Cookie', cookie)
        .set('Origin', web)
        .expect(200);
      expect(review.body.redirectUri).toBe(callback);
      const approval = await http()
        .post(`${path}/decision`)
        .set('Host', '127.0.0.1:4444')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Cookie', cookie)
        .set('Origin', web)
        .send({
          decision: 'approve',
          reviewToken: review.body.reviewToken,
          scopes: ['documents:read'],
        })
        .expect(200);
      const code = new URL(approval.body.redirectUrl).searchParams.get('code');
      await http()
        .post('/v1/mcp-oauth/token')
        .set('Host', '127.0.0.1:4444')
        .send(exchange(code))
        .expect(400);
      const token = await http()
        .post('/v1/mcp-oauth/token')
        .set('Host', '127.0.0.1:4444')
        .type('form')
        .send(exchange(code))
        .expect(200);
      expect(token.headers['cache-control']).toBe('no-store');
      expect(token.body.refresh_token).toMatch(/^[a-f0-9]{64}$/);
      expect(token.body.scope).toBe('documents:read');
      const principal = await service.authenticateBearer(`Bearer ${token.body.access_token}`);
      const list = await http()
        .get('/v1/ai-connections')
        .set('Host', '127.0.0.1:4444')
        .set('Authorization', `Bearer ${jwt}`)
        .set('Origin', web)
        .expect(200);
      expect(list.body.connections[0].id).toBe(principal.grantId);
      await http()
        .post('/v1/mcp-oauth/revoke')
        .set('Host', '127.0.0.1:4444')
        .type('form')
        .send({ token: token.body.access_token, client_id: 'test-client' })
        .expect(200, {});
      await expect(service.revalidate(principal)).rejects.toThrow();
    },
  );

  httpTest(
    'refreshes over real HTTP forms and revokes the grant when an old refresh token is reused',
    async () => {
      const http = () => supertest(app.getHttpServer());
      const start = await approved();
      const form = (body: object, path = '/v1/mcp-oauth/token') =>
        http().post(path).set('Host', '127.0.0.1:4444').type('form').send(body);
      const refreshBody = (refresh_token: string) => ({
        grant_type: 'refresh_token',
        refresh_token,
        client_id: 'test-client',
        resource: `${api}/mcp`,
      });
      const issued = await form(exchange(start.code)).expect(200);
      expect(Object.keys(issued.body).sort()).toEqual([
        'access_token',
        'expires_in',
        'refresh_token',
        'scope',
        'token_type',
      ]);
      const original = await service.authenticateBearer(`Bearer ${issued.body.access_token}`);
      // JSON bodies, query strings and Authorization headers stay invalid_request.
      const rejected = [
        await http()
          .post('/v1/mcp-oauth/token')
          .set('Host', '127.0.0.1:4444')
          .send(refreshBody(issued.body.refresh_token)),
        await form(refreshBody(issued.body.refresh_token), '/v1/mcp-oauth/token?scope=x'),
        await http()
          .post('/v1/mcp-oauth/token')
          .set('Host', '127.0.0.1:4444')
          .set('Authorization', 'Basic dGVzdC1jbGllbnQ6')
          .type('form')
          .send(refreshBody(issued.body.refresh_token)),
      ];
      for (const response of rejected)
        expect([response.status, response.body.error]).toEqual([400, 'invalid_request']);
      const first = await form(refreshBody(issued.body.refresh_token)).expect(200);
      expect(first.headers['cache-control']).toBe('no-store');
      expect(first.body).toEqual({
        access_token: expect.stringMatching(/^[a-f0-9]{64}$/),
        token_type: 'Bearer',
        expires_in: expect.any(Number),
        refresh_token: expect.stringMatching(/^[a-f0-9]{64}$/),
        scope: 'sources:read',
      });
      expect(first.body.refresh_token).not.toBe(issued.body.refresh_token);
      expect((await service.authenticateBearer(`Bearer ${first.body.access_token}`)).grantId).toBe(
        original.grantId,
      );
      const second = await form(refreshBody(first.body.refresh_token)).expect(200);
      await service.authenticateBearer(`Bearer ${second.body.access_token}`);
      const reused = await form(refreshBody(issued.body.refresh_token)).expect(400);
      expect(reused.headers['cache-control']).toBe('no-store');
      expect(reused.body).toEqual({
        error: 'invalid_grant',
        error_description: 'Request rejected.',
      });
      expect(
        (await db.getRepository(McpOAuthGrant).findOneByOrFail({ id: original.grantId })).revoked,
      ).toBe(true);
      await expect(
        service.authenticateBearer(`Bearer ${second.body.access_token}`),
      ).rejects.toMatchObject({ status: 401 });
      await form(refreshBody(second.body.refresh_token)).expect(400, {
        error: 'invalid_grant',
        error_description: 'Request rejected.',
      });
    },
  );

  httpTest(
    'revokes the grant over real HTTP when an authorization code is replayed with its verifier',
    async () => {
      const http = () => supertest(app.getHttpServer());
      const start = await approved();
      const form = (body: object) =>
        http().post('/v1/mcp-oauth/token').set('Host', '127.0.0.1:4444').type('form').send(body);
      const rejected = { error: 'invalid_grant', error_description: 'Request rejected.' };
      const issued = await form(exchange(start.code)).expect(200);
      const principal = await service.authenticateBearer(`Bearer ${issued.body.access_token}`);
      const refreshed = await form({
        grant_type: 'refresh_token',
        refresh_token: issued.body.refresh_token,
        client_id: 'test-client',
        resource: `${api}/mcp`,
      }).expect(200);
      // Without the verifier the replay is indistinguishable from an unknown code and revokes nothing.
      await form({ ...exchange(start.code), code_verifier: undefined }).expect(400, rejected);
      await form(exchange('e'.repeat(64))).expect(400, rejected);
      await service.authenticateBearer(`Bearer ${refreshed.body.access_token}`);
      const replay = await form(exchange(start.code)).expect(400, rejected);
      expect(replay.headers['cache-control']).toBe('no-store');
      expect(
        (await db.getRepository(McpOAuthGrant).findOneByOrFail({ id: principal.grantId })).revoked,
      ).toBe(true);
      await expect(
        service.authenticateBearer(`Bearer ${refreshed.body.access_token}`),
      ).rejects.toMatchObject({ status: 401 });
      await form({
        grant_type: 'refresh_token',
        refresh_token: refreshed.body.refresh_token,
        client_id: 'test-client',
      }).expect(400, rejected);
      await form(exchange(start.code)).expect(400, rejected);
    },
  );
});

describe('MCP OAuth exception filtering', () => {
  function filtered(error: unknown) {
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    new McpOAuthExceptionFilter().catch(error, {
      switchToHttp: () => ({ getResponse: () => response }),
    } as ArgumentsHost);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    return response;
  }

  it('preserves the exact JwtAuthGuard expired-token 401 marker for GET renewal', () => {
    const response = filtered(new HttpException('accessTokenExpired', 401));
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: 'accessTokenExpired' });
  });

  it.each([
    new HttpException('accessTokenExpired', 403),
    new HttpException('accessTokenExpired secret', 401),
    new HttpException({ message: 'accessTokenExpired', secret: 'private' }, 401),
    new UnauthorizedException('private'),
    new Error('private'),
  ])('masks every other error response %#', error => {
    const response = filtered(error);
    const status = error instanceof HttpException ? error.getStatus() : 500;
    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({
      error: status >= 500 ? 'temporarily_unavailable' : 'invalid_request',
      message: 'Request rejected.',
    });
  });
});
