import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import OAuth2Server = require('@node-oauth/oauth2-server');
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, EntityManager, In, LessThanOrEqual, MoreThan } from 'typeorm';
import { z } from 'zod';
import { serializeMetadataWork } from '../common/metadata-work';
import { lockSourceActor, sourceWriteTransaction } from '../database/source-write-lock';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { User } from '../user/entities/user.entity';
import { McpConfig, mcpScopeSchema, readMcpConfig } from './config';
import { McpOAuthCode, McpOAuthGrant, McpOAuthPending, McpOAuthToken } from './mcp-oauth.entities';

export type McpOAuthActor = { actorId: number; authVersion: number };
export type McpOAuthPrincipal = McpOAuthActor & {
  grantId: string;
  organizationId: number;
  scopes: string[];
};

const authorizationSchema = z
  .object({
    response_type: z.literal('code'),
    client_id: z.string().min(1).max(255),
    redirect_uri: z.string().min(1).max(2048),
    state: z.string().regex(/^[\x20-\x7e]{1,512}$/),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    code_challenge_method: z.literal('S256'),
    resource: z.string().max(2048),
    scope: z.string().min(1).max(100),
  })
  .strict();
const decisionSchema = z
  .object({
    decision: z.enum(['approve', 'cancel']),
    reviewToken: z.string().regex(/^[a-f0-9]{64}$/),
    scopes: z.array(mcpScopeSchema).max(2),
  })
  .strict();
const exchangeSchema = z
  .object({
    grant_type: z.literal('authorization_code'),
    code: z.string().regex(/^[a-f0-9]{64}$/),
    client_id: z.string().min(1).max(255),
    redirect_uri: z.string().min(1).max(2048),
    code_verifier: z.string().max(512).optional(),
    resource: z.string().max(2048),
  })
  .strict();
const revokeSchema = z
  .object({
    token: z.string().max(4096),
    client_id: z.string().min(1).max(255),
    token_type_hint: z.string().max(64).optional(),
  })
  .strict();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const randomSecret = () => randomBytes(32).toString('hex');
const same = (left: string, right: string) => {
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

@Injectable()
export class McpOAuthService {
  private readonly bearerProofs = new WeakMap<McpOAuthPrincipal, string>();
  private pendingAdmission: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: DataSource) {}

  private config(fingerprint?: string): McpConfig {
    const config = readMcpConfig();
    if (!config) throw new ServiceUnavailableException('OAuth unavailable.');
    if (fingerprint !== undefined && config.fingerprint !== fingerprint)
      throw new ForbiddenException('Authorization unavailable.');
    return config;
  }

  authorizationMetadata() {
    const config = this.config();
    return {
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/authorize`,
      token_endpoint: `${config.issuer}/token`,
      revocation_endpoint: `${config.issuer}/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none'],
      revocation_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['sources:read', 'documents:read'],
      code_challenge_methods_supported: ['S256'],
    };
  }

  async authorize(query: unknown, existingBrowser?: string) {
    const config = this.config();
    const parsed = authorizationSchema.safeParse(query);
    if (!parsed.success)
      throw new OAuth2Server.InvalidRequestError('Invalid authorization request.');
    const input = parsed.data;
    const client = config.clients.find(client => client.id === input.client_id);
    if (!client || !client.redirectUris.includes(input.redirect_uri))
      throw new OAuth2Server.InvalidClientError('Invalid client.');
    const scopes = input.scope.split(' ');
    if (
      !scopes.length ||
      new Set(scopes).size !== scopes.length ||
      scopes.some(scope => !client.scopes.some(allowed => allowed === scope))
    )
      throw new OAuth2Server.InvalidScopeError('Invalid scope.');
    if (input.resource !== config.resource)
      throw new OAuth2Server.InvalidRequestError('Invalid resource.');
    const ticket = randomSecret();
    const browser =
      typeof existingBrowser === 'string' && /^[a-f0-9]{64}$/.test(existingBrowser)
        ? existingBrowser
        : randomSecret();
    const admit = () =>
      sourceWriteTransaction(this.db, async manager => {
        this.config(config.fingerprint);
        const now = new Date(Date.now());
        const expired = await manager.find(McpOAuthPending, {
          select: { ticketHash: true },
          where: { status: 'pending', expiresAt: LessThanOrEqual(now) },
          order: { expiresAt: 'ASC', ticketHash: 'ASC' },
          take: 500,
        });
        if (expired.length)
          await manager.delete(McpOAuthPending, {
            ticketHash: In(expired.map(row => row.ticketHash)),
            status: 'pending',
            expiresAt: LessThanOrEqual(now),
          });
        const [total, browserPending] = await Promise.all([
          manager.countBy(McpOAuthPending, { status: 'pending', expiresAt: MoreThan(now) }),
          manager.countBy(McpOAuthPending, {
            browserHash: hash(browser),
            status: 'pending',
            expiresAt: MoreThan(now),
          }),
        ]);
        if (total >= 1000 || browserPending >= 10)
          throw new ServiceUnavailableException('Authorization capacity reached.');
        await manager.insert(McpOAuthPending, {
          ticketHash: hash(ticket),
          browserHash: hash(browser),
          clientId: client.id,
          redirectUri: input.redirect_uri,
          state: input.state,
          codeChallenge: input.code_challenge,
          scopes,
          resource: config.resource,
          configFingerprint: config.fingerprint,
          expiresAt: new Date(Date.now() + 5 * 60_000),
          status: 'pending',
        });
      });
    // The product supports one process. Serialize capacity checks for MySQL as well as SQLite.
    const admission = this.pendingAdmission.then(admit, admit);
    this.pendingAdmission = admission.catch(() => undefined);
    await admission;
    return {
      redirectUrl: `${config.webBase}/ai-connections/approve/${ticket}`,
      browser,
      secure: new URL(config.apiBase).protocol === 'https:',
    };
  }

  private async actorContext(manager: EntityManager, actor: McpOAuthActor) {
    if (
      !Number.isSafeInteger(actor.actorId) ||
      actor.actorId <= 0 ||
      !Number.isSafeInteger(actor.authVersion) ||
      actor.authVersion < 0
    )
      throw new UnauthorizedException('Authorization unavailable.');
    const user = await manager.findOneBy(User, { id: actor.actorId });
    if (!user || !user.active || user.authVersion !== actor.authVersion)
      throw new UnauthorizedException('Authorization unavailable.');
    const membership = await manager.findOneBy(EnterpriseMembership, { userId: user.id });
    const organization = membership
      ? await manager.findOneBy(EnterpriseOrganization, { id: membership.organizationId })
      : null;
    return { user, organization };
  }

  async connections(actor: McpOAuthActor) {
    return serializeMetadataWork(this.db, async () => {
      const context = await this.actorContext(this.db.manager, actor);
      const config = readMcpConfig();
      const grants = context.organization
        ? await this.db.manager.find(McpOAuthGrant, {
            where: { actorId: actor.actorId, organizationId: context.organization.id },
            order: { createdAt: 'DESC' },
          })
        : [];
      return {
        configured: !!config,
        resourceUrl: config?.resource ?? null,
        organization: context.organization
          ? { id: context.organization.id, name: context.organization.name }
          : null,
        connections: grants.map(grant => ({
          id: grant.id,
          clientName: grant.clientName,
          clientId: grant.clientId,
          organizationId: grant.organizationId,
          scopes: grant.scopes,
          createdAt: grant.createdAt,
          expiresAt: grant.expiresAt,
          revoked:
            grant.revoked ||
            grant.authVersion !== actor.authVersion ||
            grant.configFingerprint !== config?.fingerprint,
        })),
      };
    });
  }

  private async pending(
    manager: EntityManager,
    ticket: string,
    browser: string,
    config: McpConfig,
  ) {
    if (
      !/^[a-f0-9]{64}$/.test(ticket) ||
      typeof browser !== 'string' ||
      !/^[a-f0-9]{64}$/.test(browser)
    )
      throw new ForbiddenException('Authorization unavailable.');
    const pending = await manager.findOneBy(McpOAuthPending, { ticketHash: hash(ticket) });
    if (!pending || !same(pending.browserHash, hash(browser)))
      throw new ForbiddenException('Authorization unavailable.');
    if (pending.status !== 'pending') throw new ConflictException('Request already decided.');
    if (
      pending.expiresAt.getTime() <= Date.now() ||
      pending.configFingerprint !== config.fingerprint ||
      pending.resource !== config.resource
    )
      throw new ForbiddenException('Authorization unavailable.');
    const client = config.clients.find(client => client.id === pending.clientId);
    if (
      !client ||
      !client.redirectUris.includes(pending.redirectUri) ||
      pending.scopes.some(scope => !client.scopes.some(allowed => allowed === scope))
    )
      throw new ForbiddenException('Authorization unavailable.');
    return { pending, client };
  }

  private reviewToken(pending: McpOAuthPending, actor: McpOAuthActor, organizationId: number) {
    const key = process.env.CONFIG_SECRET_KEY;
    if (!key) throw new ServiceUnavailableException('OAuth unavailable.');
    return createHmac('sha256', key)
      .update(
        JSON.stringify([
          'mcp-oauth-review-v1',
          pending.ticketHash,
          pending.browserHash,
          actor.actorId,
          actor.authVersion,
          organizationId,
          pending.clientId,
          pending.configFingerprint,
          pending.resource,
          pending.redirectUri,
          pending.scopes,
          pending.state,
          pending.codeChallenge,
          pending.expiresAt.toISOString(),
        ]),
      )
      .digest('hex');
  }

  async request(actor: McpOAuthActor, ticket: string, browser: string) {
    return serializeMetadataWork(this.db, async () => {
      const config = this.config();
      const { pending, client } = await this.pending(this.db.manager, ticket, browser, config);
      const { user, organization } = await this.actorContext(this.db.manager, actor);
      if (!organization) throw new ForbiddenException('Organization required.');
      return {
        ticket,
        clientName: client.name,
        clientId: client.id,
        redirectUri: pending.redirectUri,
        organization: { id: organization.id, name: organization.name },
        accountLabel: user.email,
        requestedScopes: pending.scopes,
        expiresAt: pending.expiresAt,
        reviewToken: this.reviewToken(pending, actor, organization.id),
      };
    });
  }

  async decision(actor: McpOAuthActor, ticket: string, browser: string, body: unknown) {
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid decision.');
    const input = parsed.data;
    return sourceWriteTransaction(this.db, async manager => {
      await lockSourceActor(manager, actor.actorId, actor.authVersion);
      const config = this.config();
      const { pending, client } = await this.pending(manager, ticket, browser, config);
      const { organization } = await this.actorContext(manager, actor);
      if (
        !organization ||
        !same(input.reviewToken, this.reviewToken(pending, actor, organization.id))
      )
        throw new ForbiddenException('Review no longer current.');
      if (
        new Set(input.scopes).size !== input.scopes.length ||
        (input.decision === 'cancel'
          ? input.scopes.length !== 0
          : !input.scopes.length ||
            input.scopes.some(
              scope => !pending.scopes.includes(scope) || !client.scopes.includes(scope),
            ))
      )
        throw new BadRequestException('Invalid consent scopes.');
      const transitioned = await manager.update(
        McpOAuthPending,
        { ticketHash: pending.ticketHash, status: 'pending', expiresAt: MoreThan(new Date()) },
        {
          status: input.decision === 'approve' ? 'approved' : 'cancelled',
        },
      );
      if (transitioned.affected !== 1) throw new ConflictException('Request already decided.');
      const redirect = new URL(pending.redirectUri);
      redirect.searchParams.set('state', pending.state);
      if (input.decision === 'cancel') {
        redirect.searchParams.set('error', 'access_denied');
        return { redirectUrl: redirect.href, approved: false };
      }
      const count = await manager.countBy(McpOAuthGrant, {
        actorId: actor.actorId,
        authVersion: actor.authVersion,
        organizationId: organization.id,
        configFingerprint: config.fingerprint,
        revoked: false,
        expiresAt: MoreThan(new Date()),
      });
      if (count >= 20) throw new ConflictException('Connection limit reached.');
      const grant = manager.create(McpOAuthGrant, {
        id: randomUUID(),
        ...actor,
        organizationId: organization.id,
        clientId: client.id,
        clientName: client.name,
        configFingerprint: config.fingerprint,
        resource: config.resource,
        scopes: input.scopes,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60_000),
        revoked: false,
      });
      const model = this.baseModel(config);
      model.saveAuthorizationCode = async code => {
        this.config(config.fingerprint);
        await manager.insert(McpOAuthGrant, grant);
        await manager.insert(McpOAuthCode, {
          codeHash: hash(code.authorizationCode),
          grantId: grant.id,
          redirectUri: pending.redirectUri,
          codeChallenge: pending.codeChallenge,
          codeChallengeMethod: 'S256',
          expiresAt: code.expiresAt,
          consumed: false,
        });
        return {
          ...code,
          client: this.libraryClient(config, client.id),
          user: { grantId: grant.id },
        };
      };
      const response = new OAuth2Server.Response();
      const code = await this.server(model).authorize(
        new OAuth2Server.Request({
          method: 'GET',
          headers: {},
          query: {
            response_type: 'code',
            client_id: client.id,
            redirect_uri: pending.redirectUri,
            state: pending.state,
            code_challenge: pending.codeChallenge,
            code_challenge_method: 'S256',
            scope: input.scopes.join(' '),
          },
        }),
        response,
        { authenticateHandler: { handle: async () => ({ grantId: grant.id }) } },
      );
      this.config(config.fingerprint);
      if (pending.expiresAt.getTime() <= Date.now())
        throw new ForbiddenException('Authorization expired.');
      redirect.searchParams.set('code', code.authorizationCode);
      return { redirectUrl: redirect.href, approved: true };
    });
  }

  private libraryClient(config: McpConfig, id: string): OAuth2Server.Client | null {
    const client = config.clients.find(client => client.id === id);
    return client
      ? { id: client.id, redirectUris: client.redirectUris, grants: ['authorization_code'] }
      : null;
  }

  private baseModel(config: McpConfig): OAuth2Server.AuthorizationCodeModel {
    return {
      getClient: async (id, secret) => (secret ? null : this.libraryClient(config, id)),
      generateAuthorizationCode: async () => randomSecret(),
      generateAccessToken: async () => randomSecret(),
      // The library calls this even for code-only clients. An empty value suppresses refresh issuance.
      generateRefreshToken: async () => '',
      getAccessToken: async () => false,
      getAuthorizationCode: async () => false,
      revokeAuthorizationCode: async () => false,
      saveAuthorizationCode: async () => {
        throw new OAuth2Server.InvalidGrantError('Invalid grant.');
      },
      saveToken: async () => {
        throw new OAuth2Server.InvalidGrantError('Invalid grant.');
      },
      validateScope: async (_user, client, scopes) => {
        const allowed = config.clients.find(item => item.id === client.id)?.scopes;
        return scopes?.length && scopes.every(scope => allowed?.some(item => item === scope))
          ? scopes
          : false;
      },
    };
  }

  private server(model: OAuth2Server.AuthorizationCodeModel) {
    const options = {
      model,
      requirePKCE: true,
      enablePlainPKCE: false,
      authorizationCodeLifetime: 120,
      accessTokenLifetime: 600,
      requireClientAuthentication: { authorization_code: false },
    };
    return new OAuth2Server(options);
  }

  private async checkedGrant(manager: EntityManager, id: string, config: McpConfig, lock = false) {
    const grant = await manager.findOne(McpOAuthGrant, {
      where: { id },
      ...(lock && ['mysql', 'mariadb'].includes(this.db.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    const client = grant && config.clients.find(client => client.id === grant.clientId);
    if (
      !grant ||
      grant.revoked ||
      grant.expiresAt.getTime() <= Date.now() ||
      grant.resource !== config.resource ||
      grant.configFingerprint !== config.fingerprint ||
      !client ||
      !grant.scopes.length ||
      grant.scopes.some(scope => !client.scopes.some(allowed => allowed === scope))
    )
      throw new UnauthorizedException('Authorization unavailable.');
    const { organization } = await this.actorContext(manager, grant);
    if (!organization || organization.id !== grant.organizationId)
      throw new UnauthorizedException('Authorization unavailable.');
    return grant;
  }

  async token(body: unknown) {
    const config = this.config();
    const parsed = exchangeSchema.safeParse(body);
    if (!parsed.success) throw new OAuth2Server.InvalidRequestError('Invalid token request.');
    const input = parsed.data;
    if (input.resource !== config.resource)
      throw new OAuth2Server.InvalidRequestError('Invalid resource.');
    const client = config.clients.find(client => client.id === input.client_id);
    if (!client || !client.redirectUris.includes(input.redirect_uri))
      throw new OAuth2Server.InvalidClientError('Invalid client.');
    const model = this.baseModel(config);
    let exchange: { code: McpOAuthCode; grant: McpOAuthGrant } | undefined;
    model.getAuthorizationCode = async raw =>
      serializeMetadataWork(this.db, async () => {
        const code = await this.db.manager.findOneBy(McpOAuthCode, {
          codeHash: hash(raw),
          consumed: false,
        });
        if (
          !code ||
          code.codeChallengeMethod !== 'S256' ||
          !/^[A-Za-z0-9_-]{43}$/.test(code.codeChallenge)
        )
          return false;
        const grant = await this.checkedGrant(
          this.db.manager,
          code.grantId,
          this.config(config.fingerprint),
        );
        exchange = { code, grant };
        return {
          authorizationCode: raw,
          expiresAt: code.expiresAt,
          redirectUri: code.redirectUri,
          codeChallenge: code.codeChallenge,
          codeChallengeMethod: 'S256',
          scope: grant.scopes,
          client: this.libraryClient(config, grant.clientId),
          user: { grantId: grant.id },
        };
      });
    // Commit consumption independently. Failed PKCE must never restore a usable code.
    model.revokeAuthorizationCode = async code =>
      sourceWriteTransaction(this.db, async manager => {
        const result = await manager.update(
          McpOAuthCode,
          {
            codeHash: hash(code.authorizationCode),
            consumed: false,
            expiresAt: MoreThan(new Date()),
          },
          { consumed: true },
        );
        return result.affected === 1;
      });
    model.saveToken = async (token, libraryClient, user) => {
      const current = exchange;
      if (!current) throw new OAuth2Server.InvalidGrantError('Invalid grant.');
      return sourceWriteTransaction(this.db, async manager => {
        await lockSourceActor(manager, current.grant.actorId, current.grant.authVersion);
        const grant = await this.checkedGrant(
          manager,
          current.grant.id,
          this.config(config.fingerprint),
          true,
        );
        if (libraryClient.id !== grant.clientId || current.code.expiresAt.getTime() <= Date.now())
          throw new OAuth2Server.InvalidGrantError('Invalid grant.');
        const expiresAt = new Date(Math.min(Date.now() + 600_000, grant.expiresAt.getTime()));
        await manager.insert(McpOAuthToken, {
          tokenHash: hash(token.accessToken),
          grantId: grant.id,
          resource: config.resource,
          expiresAt,
        });
        this.config(config.fingerprint);
        return {
          accessToken: token.accessToken,
          accessTokenExpiresAt: expiresAt,
          scope: grant.scopes,
          client: libraryClient,
          user,
        };
      });
    };
    const response = new OAuth2Server.Response();
    const encodedBody = new URLSearchParams(
      Object.entries(input).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ).toString();
    try {
      await this.server(model).token(
        new OAuth2Server.Request({
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'content-length': String(Buffer.byteLength(encodedBody)),
          },
          query: {},
          body: input,
        }),
        response,
      );
    } catch (error) {
      if (
        error instanceof OAuth2Server.ServerError &&
        (error.inner instanceof UnauthorizedException || error.inner instanceof ForbiddenException)
      )
        throw new OAuth2Server.InvalidGrantError('Invalid grant.');
      if (error instanceof OAuth2Server.OAuthError) throw error;
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException)
        throw new OAuth2Server.InvalidGrantError('Invalid grant.');
      throw new OAuth2Server.ServerError('Token request failed.');
    }
    const output = z
      .object({
        access_token: z.string(),
        token_type: z.string(),
        expires_in: z.number(),
        scope: z.string(),
      })
      .parse(response.body);
    return output;
  }

  async disconnect(actor: McpOAuthActor, id: string, body: unknown) {
    if (!z.object({}).strict().safeParse(body).success || !z.string().uuid().safeParse(id).success)
      throw new BadRequestException('Invalid disconnect request.');
    return sourceWriteTransaction(this.db, async manager => {
      await lockSourceActor(manager, actor.actorId, actor.authVersion);
      const { organization } = await this.actorContext(manager, actor);
      const grant = await manager.findOne(McpOAuthGrant, {
        where: { id },
        ...(['mysql', 'mariadb'].includes(this.db.options.type)
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (
        !grant ||
        !organization ||
        grant.actorId !== actor.actorId ||
        grant.organizationId !== organization.id
      )
        throw new ForbiddenException('Authorization unavailable.');
      await manager.update(McpOAuthGrant, { id: grant.id, revoked: false }, { revoked: true });
      return { revoked: true as const };
    });
  }

  async revoke(body: unknown) {
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) throw new OAuth2Server.InvalidRequestError('Invalid revocation request.');
    const input = parsed.data;
    if (!/^[a-f0-9]{64}$/.test(input.token)) return {};
    await sourceWriteTransaction(this.db, async manager => {
      const token = await manager.findOneBy(McpOAuthToken, { tokenHash: hash(input.token) });
      if (!token) return;
      const grant = await manager.findOneBy(McpOAuthGrant, {
        id: token.grantId,
        clientId: input.client_id,
      });
      if (!grant) return;
      // Revocation remains possible after an epoch change or account deactivation.
      await manager.findOne(User, {
        where: { id: grant.actorId },
        ...(['mysql', 'mariadb'].includes(this.db.options.type)
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      await manager.update(
        McpOAuthGrant,
        { id: grant.id, clientId: input.client_id, revoked: false },
        { revoked: true },
      );
    });
    return {};
  }

  private async principalForHash(tokenHash: string): Promise<McpOAuthPrincipal> {
    return serializeMetadataWork(this.db, async () => {
      const config = this.config();
      const token = await this.db.manager.findOneBy(McpOAuthToken, { tokenHash });
      if (!token || token.expiresAt.getTime() <= Date.now() || token.resource !== config.resource)
        throw new UnauthorizedException('Authorization unavailable.');
      const grant = await this.checkedGrant(this.db.manager, token.grantId, config);
      this.config(config.fingerprint);
      return {
        grantId: grant.id,
        actorId: grant.actorId,
        authVersion: grant.authVersion,
        organizationId: grant.organizationId,
        scopes: [...grant.scopes],
      };
    });
  }

  async authenticateBearer(authorization: string): Promise<McpOAuthPrincipal> {
    const match =
      typeof authorization === 'string' && /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
    if (!match) throw new UnauthorizedException('Authorization unavailable.');
    try {
      const tokenHash = hash(match[1]);
      const principal = await this.principalForHash(tokenHash);
      this.bearerProofs.set(principal, tokenHash);
      return principal;
    } catch {
      throw new UnauthorizedException('Authorization unavailable.');
    }
  }

  async revalidate(principal: McpOAuthPrincipal): Promise<void> {
    try {
      const tokenHash = this.bearerProofs.get(principal);
      if (!tokenHash) throw new UnauthorizedException();
      const current = await this.principalForHash(tokenHash);
      if (JSON.stringify(current) !== JSON.stringify(principal)) throw new UnauthorizedException();
    } catch {
      throw new UnauthorizedException('Authorization unavailable.');
    }
  }
}
