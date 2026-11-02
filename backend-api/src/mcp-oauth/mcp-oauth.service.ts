import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import OAuth2Server = require('@node-oauth/oauth2-server');
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { DataSource, EntityManager, In, IsNull, LessThanOrEqual, MoreThan } from 'typeorm';
import { z } from 'zod';
import { serializeMetadataWork } from '../common/metadata-work';
import { lockSourceActor, sourceWriteTransaction } from '../database/source-write-lock';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { User } from '../user/entities/user.entity';
import {
  MCP_SCOPES,
  McpConfig,
  McpScope,
  mcpAccessTtlSeconds,
  mcpAuthorizationMetadata,
  mcpScopeSchema,
  readMcpConfig,
} from './config';
import {
  McpOAuthCode,
  McpOAuthGrant,
  McpOAuthPending,
  McpOAuthRefresh,
  McpOAuthToken,
} from './mcp-oauth.entities';

export type McpOAuthActor = { actorId: number; authVersion: number };
type McpRefreshLog = { grantId: string; clientId: string; actorId: number; rotation: number };
export type McpOAuthPrincipal = McpOAuthActor & {
  grantId: string;
  organizationId: number;
  clientName: string;
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
    scope: z.string().min(1).max(512),
  })
  .strict();
const decisionSchema = z
  .object({
    decision: z.enum(['approve', 'cancel']),
    reviewToken: z.string().regex(/^[a-f0-9]{64}$/),
    scopes: z.array(mcpScopeSchema).max(MCP_SCOPES.length),
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
// Claude Code sends grant_type, refresh_token, resource and client_id. Codex (rmcp 3.2.0 on the
// oauth2 5.0.0 crate) sends grant_type, refresh_token, client_id and probably resource. redirect_uri
// is tolerated and ignored because some MCP clients send it; every other key is invalid_request.
const refreshSchema = z
  .object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().max(4096),
    client_id: z.string().min(1).max(255),
    resource: z.string().max(2048).optional(),
    scope: z.string().min(1).max(512).optional(),
    redirect_uri: z.string().max(2048).optional(),
  })
  .strict();
const tokenResponseSchema = z
  .object({
    access_token: z.string(),
    token_type: z.literal('Bearer'),
    expires_in: z.number(),
    refresh_token: z.string(),
    scope: z.string(),
  })
  .strict();
type TokenResponse = z.infer<typeof tokenResponseSchema>;
/** A grant ends after 8 hours; Claude refreshes about every 5 minutes (about 96 rotations). */
export const MCP_REFRESH_ROTATION_CAP = 300;
/** A rotated token may be re-rotated once within this window of its first use. */
export const MCP_REFRESH_RETRY_WINDOW_MS = 30_000;
/** Opportunistic cleanup deletes at most this many rows per table per run. */
export const MCP_OAUTH_CLEANUP_BATCH = 500;
/** Rows are deleted only once their deciding timestamp is older than this margin. */
export const MCP_OAUTH_CLEANUP_GRACE_MS = 5 * 60_000;
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
  private readonly logger = new Logger(McpOAuthService.name);
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
    return mcpAuthorizationMetadata(this.config());
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
      // Code exchange issues the first refresh token of the grant (saveToken stores its hash).
      generateRefreshToken: async () => randomSecret(),
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
      accessTokenLifetime: mcpAccessTtlSeconds(),
      // Library default is two weeks. Stored refresh rows expire with the grant (8 hours) instead.
      refreshTokenLifetime: 8 * 60 * 60,
      requireClientAuthentication: { authorization_code: false },
    };
    return new OAuth2Server(options);
  }

  private async checkedGrant(manager: EntityManager, id: string, config: McpConfig, lock = false) {
    const grant = await manager.findOne(McpOAuthGrant, {
      where: { id },
      ...(lock && this.db.options.type !== 'sqlite'
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

  /** Stores one access token and its paired refresh token; returns the access expiry. */
  private async insertPair(
    manager: EntityManager,
    grant: McpOAuthGrant,
    config: McpConfig,
    accessToken: string,
    refreshToken: string,
    parent: McpOAuthRefresh | null,
  ) {
    const now = Date.now();
    const expiresAt = new Date(
      Math.min(now + mcpAccessTtlSeconds() * 1000, grant.expiresAt.getTime()),
    );
    await manager.insert(McpOAuthToken, {
      tokenHash: hash(accessToken),
      grantId: grant.id,
      resource: config.resource,
      expiresAt,
    });
    await manager.insert(McpOAuthRefresh, {
      tokenHash: hash(refreshToken),
      grantId: grant.id,
      clientId: grant.clientId,
      resource: config.resource,
      accessHash: hash(accessToken),
      rotation: parent ? parent.rotation + 1 : 0,
      parentHash: parent?.tokenHash ?? null,
      replacedByHash: null,
      state: 'active',
      issuedAt: new Date(now),
      expiresAt: grant.expiresAt,
      usedAt: null,
      retriedAt: null,
    });
    return expiresAt;
  }

  async token(body: unknown) {
    if (
      body &&
      typeof body === 'object' &&
      (body as Record<string, unknown>).grant_type === 'refresh_token'
    )
      return this.refresh(body);
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
    model.getAuthorizationCode = async raw => {
      const replayed = await serializeMetadataWork(this.db, () =>
        this.db.manager.findOneBy(McpOAuthCode, { codeHash: hash(raw), consumed: true }),
      );
      if (replayed) {
        await this.revokeReplayedCode(replayed, input);
        return false;
      }
      return serializeMetadataWork(this.db, async () => {
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
    };
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
        // Grant before actor, the same order as disconnect, revoke and MCP writes (assertGrant).
        const grant = await this.checkedGrant(
          manager,
          current.grant.id,
          this.config(config.fingerprint),
          true,
        );
        await lockSourceActor(manager, grant.actorId, grant.authVersion);
        if (
          libraryClient.id !== grant.clientId ||
          current.code.expiresAt.getTime() <= Date.now() ||
          !/^[a-f0-9]{64}$/.test(token.refreshToken ?? '')
        )
          throw new OAuth2Server.InvalidGrantError('Invalid grant.');
        const expiresAt = await this.insertPair(
          manager,
          grant,
          config,
          token.accessToken,
          token.refreshToken,
          null,
        );
        this.config(config.fingerprint);
        return {
          accessToken: token.accessToken,
          accessTokenExpiresAt: expiresAt,
          refreshToken: token.refreshToken,
          refreshTokenExpiresAt: grant.expiresAt,
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
    const issued = tokenResponseSchema.parse(response.body);
    await this.cleanupExpired();
    return issued;
  }

  /**
   * A consumed code presented again (RFC 6749 §4.1.2, RFC 9700) revokes its grant, but only
   * when the request also proves possession of the PKCE verifier for the same client and
   * redirect_uri. A party holding only the code (for example from a log) could never have
   * redeemed it, so revoking on its replay would add a denial of service and no protection.
   */
  private async revokeReplayedCode(code: McpOAuthCode, input: z.infer<typeof exchangeSchema>) {
    const verifier = input.code_verifier;
    if (
      typeof verifier !== 'string' ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) ||
      code.codeChallengeMethod !== 'S256' ||
      input.redirect_uri !== code.redirectUri ||
      !same(createHash('sha256').update(verifier).digest('base64url'), code.codeChallenge)
    )
      return;
    const log = await sourceWriteTransaction(this.db, async manager => {
      // Grant row before the actor row, as in revoke; no grant validity check so it stays idempotent.
      const grant = await manager.findOne(McpOAuthGrant, {
        where: { id: code.grantId },
        ...(this.db.options.type !== 'sqlite'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!grant || grant.clientId !== input.client_id) return null;
      await manager.findOne(User, {
        where: { id: grant.actorId },
        ...(this.db.options.type !== 'sqlite'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      const result = await manager.update(
        McpOAuthGrant,
        { id: grant.id, revoked: false },
        { revoked: true },
      );
      return {
        grantId: grant.id,
        clientId: grant.clientId,
        actorId: grant.actorId,
        revoked: result.affected === 1,
      };
    });
    if (log)
      this.logger.warn(`MCP authorization code replay; grant revoked ${JSON.stringify(log)}`);
  }

  /**
   * Bounded opportunistic cleanup after a token response committed, outside any grant lock.
   * Grants are never deleted. Failures are logged and never fail the token response.
   */
  private async cleanupExpired() {
    try {
      await sourceWriteTransaction(this.db, async manager => {
        const cut = new Date(Date.now() - MCP_OAUTH_CLEANUP_GRACE_MS);
        const tokens = await manager.find(McpOAuthToken, {
          select: { tokenHash: true },
          where: { expiresAt: LessThanOrEqual(cut) },
          take: MCP_OAUTH_CLEANUP_BATCH,
        });
        if (tokens.length)
          await manager.delete(McpOAuthToken, {
            tokenHash: In(tokens.map(row => row.tokenHash)),
          });
        // Rotated rows of a live grant are reuse evidence and stay until the grant ends.
        const refreshes: { tokenHash: string }[] = await manager
          .createQueryBuilder(McpOAuthRefresh, 'r')
          .innerJoin(McpOAuthGrant, 'g', 'g.id = r.grantId')
          .select('r.tokenHash', 'tokenHash')
          .where(
            'r.expiresAt <= :cut OR g.expiresAt <= :cut OR (g.revoked = :revoked AND r.issuedAt <= :cut)',
            { cut, revoked: true },
          )
          .limit(MCP_OAUTH_CLEANUP_BATCH)
          .getRawMany();
        if (refreshes.length)
          await manager.delete(McpOAuthRefresh, {
            tokenHash: In(refreshes.map(row => row.tokenHash)),
          });
        // A consumed code stays while its grant lives so that a replay can still revoke it.
        const codes: { codeHash: string }[] = await manager
          .createQueryBuilder(McpOAuthCode, 'c')
          .innerJoin(McpOAuthGrant, 'g', 'g.id = c.grantId')
          .select('c.codeHash', 'codeHash')
          .where('c.expiresAt <= :cut', { cut })
          .andWhere('(c.consumed = :unused OR g.revoked = :revoked OR g.expiresAt <= :cut)', {
            unused: false,
            revoked: true,
          })
          .limit(MCP_OAUTH_CLEANUP_BATCH)
          .getRawMany();
        if (codes.length)
          await manager.delete(McpOAuthCode, { codeHash: In(codes.map(row => row.codeHash)) });
      });
    } catch (error) {
      const code = (error as { driverError?: { code?: unknown } })?.driverError?.code;
      this.logger.error(
        `MCP OAuth cleanup failed ${JSON.stringify({
          error: (error as object)?.constructor?.name ?? typeof error,
          code: typeof code === 'string' ? code : undefined,
        })}`,
      );
    }
  }

  /**
   * refresh_token grant, handled here rather than by the library so that marking the presented
   * token used and issuing its successor commit together, and so that a detected reuse can commit
   * the grant revocation before answering invalid_grant. See docs/plans/mcp-oauth-refresh.md.
   */
  private async refresh(body: unknown): Promise<TokenResponse> {
    const config = this.config();
    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) throw new OAuth2Server.InvalidRequestError('Invalid token request.');
    const input = parsed.data;
    if (input.resource !== undefined && input.resource !== config.resource)
      throw new OAuth2Server.InvalidRequestError('Invalid resource.');
    if (!config.clients.some(client => client.id === input.client_id))
      throw new OAuth2Server.InvalidClientError('Invalid client.');
    const requested = input.scope?.split(' ');
    if (
      requested &&
      (requested.some(scope => !scope) || new Set(requested).size !== requested.length)
    )
      throw new OAuth2Server.InvalidScopeError('Invalid scope.');
    if (!/^[a-f0-9]{64}$/.test(input.refresh_token))
      throw new OAuth2Server.InvalidGrantError('Invalid grant.');
    const presented = hash(input.refresh_token);
    type Outcome =
      | { kind: 'issued'; response: TokenResponse; retried?: McpRefreshLog }
      | { kind: 'reuse'; log: McpRefreshLog };
    let outcome: Outcome;
    try {
      outcome = await sourceWriteTransaction(this.db, async (manager): Promise<Outcome> => {
        const found = await manager.findOneBy(McpOAuthRefresh, { tokenHash: presented });
        if (!found) throw new OAuth2Server.InvalidGrantError('Invalid grant.');
        // Grant before actor, as in code exchange, disconnect, revoke and MCP writes.
        const grant = await this.checkedGrant(
          manager,
          found.grantId,
          this.config(config.fingerprint),
          true,
        );
        await lockSourceActor(manager, grant.actorId, grant.authVersion);
        // Every rotation of this grant waits on the grant lock, so this read is current.
        const row = await manager.findOneBy(McpOAuthRefresh, { tokenHash: presented });
        const now = Date.now();
        if (
          !row ||
          row.grantId !== grant.id ||
          row.clientId !== input.client_id ||
          grant.clientId !== input.client_id ||
          row.resource !== config.resource ||
          row.expiresAt.getTime() <= now ||
          row.rotation >= MCP_REFRESH_ROTATION_CAP
        )
          throw new OAuth2Server.InvalidGrantError('Invalid grant.');
        if (requested?.some(scope => !grant.scopes.includes(scope)))
          throw new OAuth2Server.InvalidScopeError('Invalid scope.');
        const log: McpRefreshLog = {
          grantId: grant.id,
          clientId: grant.clientId,
          actorId: grant.actorId,
          rotation: row.rotation,
        };
        const accessToken = randomSecret();
        const refreshToken = randomSecret();
        const issue = async () => {
          const expiresAt = await this.insertPair(
            manager,
            grant,
            config,
            accessToken,
            refreshToken,
            row,
          );
          this.config(config.fingerprint);
          return {
            access_token: accessToken,
            token_type: 'Bearer' as const,
            expires_in: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
            refresh_token: refreshToken,
            scope: grant.scopes.join(' '),
          };
        };
        const changed = (result: { affected?: number }) => {
          if (result.affected !== 1) throw new ServiceUnavailableException('Refresh conflict.');
        };
        if (row.state === 'active') {
          changed(
            await manager.update(
              McpOAuthRefresh,
              { tokenHash: row.tokenHash, state: 'active' },
              { state: 'rotated', usedAt: new Date(now), replacedByHash: hash(refreshToken) },
            ),
          );
          return { kind: 'issued', response: await issue() };
        }
        const successor =
          row.state === 'rotated' && row.replacedByHash
            ? await manager.findOneBy(McpOAuthRefresh, { tokenHash: row.replacedByHash })
            : null;
        // Negative elapsed time (clock or timezone skew) is never inside the window.
        const elapsed = row.usedAt ? now - row.usedAt.getTime() : -1;
        if (
          row.state === 'rotated' &&
          row.retriedAt === null &&
          elapsed >= 0 &&
          elapsed < MCP_REFRESH_RETRY_WINDOW_MS &&
          successor?.state === 'active' &&
          successor.grantId === grant.id &&
          successor.parentHash === row.tokenHash
        ) {
          changed(
            await manager.update(
              McpOAuthRefresh,
              { tokenHash: successor.tokenHash, state: 'active' },
              { state: 'superseded' },
            ),
          );
          await manager.delete(McpOAuthToken, {
            tokenHash: successor.accessHash,
            grantId: grant.id,
          });
          // usedAt stays at the first use, so the window never slides.
          changed(
            await manager.update(
              McpOAuthRefresh,
              { tokenHash: row.tokenHash, state: 'rotated', retriedAt: IsNull() },
              { retriedAt: new Date(now), replacedByHash: hash(refreshToken) },
            ),
          );
          return { kind: 'issued', response: await issue(), retried: log };
        }
        // Reuse: commit the revocation, then answer invalid_grant outside the transaction.
        await manager.update(McpOAuthGrant, { id: grant.id, revoked: false }, { revoked: true });
        return { kind: 'reuse', log };
      });
    } catch (error) {
      if (error instanceof OAuth2Server.OAuthError) throw error;
      // Grant state (checkedGrant, lockSourceActor, fingerprint) is a definitive rejection. Missing
      // configuration, database errors and lock timeouts are not: Claude deletes its tokens on
      // invalid_grant, so those stay 5xx temporarily_unavailable.
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException)
        throw new OAuth2Server.InvalidGrantError('Invalid grant.');
      // Never log the message or query parameters: the token hash is a bind parameter.
      const code = (error as { driverError?: { code?: unknown } })?.driverError?.code;
      this.logger.error(
        `MCP refresh unavailable ${JSON.stringify({
          error: (error as object)?.constructor?.name ?? typeof error,
          code: typeof code === 'string' ? code : undefined,
        })}`,
      );
      throw new ServiceUnavailableException('Token request failed.');
    }
    if (outcome.kind === 'reuse') {
      this.logger.warn(`MCP refresh token reuse; grant revoked ${JSON.stringify(outcome.log)}`);
      throw new OAuth2Server.InvalidGrantError('Invalid grant.');
    }
    if (outcome.retried)
      this.logger.warn(
        `MCP refresh token re-rotated inside the retry window ${JSON.stringify(outcome.retried)}`,
      );
    const issued = tokenResponseSchema.parse(outcome.response);
    await this.cleanupExpired();
    return issued;
  }

  async disconnect(actor: McpOAuthActor, id: string, body: unknown) {
    if (!z.object({}).strict().safeParse(body).success || !z.string().uuid().safeParse(id).success)
      throw new BadRequestException('Invalid disconnect request.');
    return sourceWriteTransaction(this.db, async manager => {
      // Grant before actor, as in token exchange and MCP writes (assertGrant, then staff locks):
      // the reverse order could deadlock against a concurrent vm_share_report on the same grant.
      const grant = await manager.findOne(McpOAuthGrant, {
        where: { id },
        ...(this.db.options.type !== 'sqlite'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      await lockSourceActor(manager, actor.actorId, actor.authVersion);
      const { organization } = await this.actorContext(manager, actor);
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
      // RFC 7009: look the token up as either type, whatever token_type_hint says.
      const token =
        (await manager.findOneBy(McpOAuthToken, { tokenHash: hash(input.token) })) ??
        (await manager.findOneBy(McpOAuthRefresh, { tokenHash: hash(input.token) }));
      if (!token) return;
      // Grant row before the actor row, the same order as token exchange, disconnect and MCP writes.
      const grant = await manager.findOne(McpOAuthGrant, {
        where: { id: token.grantId, clientId: input.client_id },
        ...(this.db.options.type !== 'sqlite'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!grant) return;
      // Revocation remains possible after an epoch change or account deactivation.
      await manager.findOne(User, {
        where: { id: grant.actorId },
        ...(this.db.options.type !== 'sqlite'
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
        clientName: grant.clientName,
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

  /**
   * Re-checks the bearer's token and grant inside a write transaction, locking the grant row so a
   * concurrent disconnect or revoke either commits first (and this fails) or waits for this write.
   */
  async assertGrant(manager: EntityManager, principal: McpOAuthPrincipal, scope: McpScope) {
    try {
      const config = this.config();
      const tokenHash = this.bearerProofs.get(principal);
      const token = tokenHash && (await manager.findOneBy(McpOAuthToken, { tokenHash }));
      if (
        !token ||
        token.grantId !== principal.grantId ||
        token.expiresAt.getTime() <= Date.now() ||
        token.resource !== config.resource
      )
        throw new UnauthorizedException();
      const grant = await this.checkedGrant(manager, principal.grantId, config, true);
      if (
        grant.actorId !== principal.actorId ||
        grant.authVersion !== principal.authVersion ||
        grant.organizationId !== principal.organizationId ||
        grant.clientName !== principal.clientName ||
        !grant.scopes.includes(scope) ||
        !principal.scopes.includes(scope)
      )
        throw new UnauthorizedException();
      this.config(config.fingerprint);
      return grant;
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
