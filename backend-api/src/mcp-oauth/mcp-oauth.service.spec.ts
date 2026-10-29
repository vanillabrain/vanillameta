import {
  ArgumentsHost,
  HttpException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import supertest = require('supertest');
import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { AddMcpOAuth1793233000000 } from '../migrations/1793233000000-add-mcp-oauth';
import { User } from '../user/entities/user.entity';
import {
  MCP_OAUTH_ENTITIES,
  McpOAuthCode,
  McpOAuthGrant,
  McpOAuthPending,
  McpOAuthToken,
} from './mcp-oauth.entities';
import { McpOAuthExceptionFilter } from './mcp-oauth.http';
import { McpOAuthModule } from './mcp-oauth.module';
import { McpOAuthService } from './mcp-oauth.service';

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
      scopes: ['sources:read'],
    });
    expect(Object.keys(token).sort()).toEqual([
      'access_token',
      'expires_in',
      'scope',
      'token_type',
    ]);
    expect(token.expires_in).toBeGreaterThanOrEqual(599);
    expect(token.expires_in).toBeLessThanOrEqual(600);
    const rows = await Promise.all(
      MCP_OAUTH_ENTITIES.map(entity => db.getRepository(entity).find()),
    );
    const stored = JSON.stringify(rows);
    for (const secret of [start.ticket, start.browser, start.code, token.access_token, verifier])
      expect(stored).not.toContain(secret);
    expect(stored).toContain(hash(token.access_token));
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
    },
  );

  it('rejects missing/wrong resource and refresh grants, then permits the original valid exchange', async () => {
    const start = await approved();
    await expect(
      service.token({ ...exchange(start.code), resource: 'https://other.test/mcp' }),
    ).rejects.toThrow();
    await expect(service.token({ ...exchange(start.code), resource: undefined })).rejects.toThrow();
    await expect(
      service.token({
        grant_type: 'refresh_token',
        refresh_token: 'no-refresh',
        client_id: 'test-client',
      }),
    ).rejects.toThrow();
    await expect(service.token(exchange(start.code))).resolves.toHaveProperty('access_token');
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
        grant_types_supported: ['authorization_code'],
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
      expect(token.body.refresh_token).toBeUndefined();
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
