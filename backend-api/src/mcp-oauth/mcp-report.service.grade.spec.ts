// ESM-only packages that Jest cannot load; nothing from them is called here.
jest.mock('ai', () => ({ generateText: jest.fn(), streamText: jest.fn(), tool: jest.fn() }));
jest.mock('@ai-sdk/provider', () => ({}));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { User } from '../user/entities/user.entity';
import { McpReportService } from './mcp-report.service';

/**
 * A connection acts with the account's own rights. The scope the user approved is a ceiling, and
 * the account's grade is a second one: a viewer who approved shares:write still cannot share.
 */
describe('MCP write grade check', () => {
  let db: DataSource;
  let service: McpReportService;
  let assertGrant: jest.Mock;
  const principal = {
    actorId: 2,
    organizationId: 1,
    authVersion: 0,
    grantId: 'grant-1',
    clientName: 'Claude Code',
  } as any;

  const setRole = (role: string | null) =>
    role === null
      ? db.getRepository(EnterpriseMembership).delete({ userId: 2 })
      : db
          .getRepository(EnterpriseMembership)
          .save({ userId: 2, organizationId: 1, role: role as any, team: '' });
  const commentWrite = (scope: string) => (service as any).write(principal, scope);
  const shareWrite = () => (service as any).shareWrite(principal);
  const allowed = async (options: { beforeAccess: (m: any) => Promise<unknown> }) => {
    try {
      await options.beforeAccess(db.manager);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) return false;
      throw error;
    }
  };

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, EnterpriseOrganization, EnterpriseMembership],
    }).initialize();
  });

  beforeEach(async () => {
    await db.getRepository(EnterpriseMembership).clear();
    await db.getRepository(EnterpriseOrganization).clear();
    await db.getRepository(User).clear();
    await db.getRepository(User).save({
      id: 2,
      userId: 'account-2',
      email: 'account-2@example.invalid',
      password: 'hash',
      active: true,
      authVersion: 0,
    });
    await db.getRepository(EnterpriseOrganization).save({ name: '바닐라메타', version: 1 });
    assertGrant = jest.fn().mockResolvedValue({});
    service = new McpReportService(db, {} as any, {} as any, { assertGrant } as any);
  });

  afterAll(async () => {
    await db?.destroy();
  });

  // Order: viewer, contributor, editor, admin, legacy member.
  const ROLES = ['viewer', 'contributor', 'editor', 'admin', 'member'];

  it.each([['comments:write'], ['suggestions:write']])(
    'lets every grade write with %s, as commenting is open to all',
    async scope => {
      for (const role of ROLES) {
        await setRole(role);
        expect(await allowed(commentWrite(scope))).toBe(true);
      }
    },
  );

  it('lets only an editor, an administrator or a legacy member share', async () => {
    const result: Record<string, boolean> = {};
    for (const role of ROLES) {
      await setRole(role);
      result[role] = await allowed(shareWrite());
    }
    expect(result).toEqual({
      viewer: false,
      contributor: false,
      editor: true,
      admin: true,
      member: true,
    });
  });

  it('refuses a connection whose account has no membership in the organization', async () => {
    await setRole(null);
    expect(await allowed(commentWrite('comments:write'))).toBe(false);
    expect(await allowed(shareWrite())).toBe(false);
  });

  it('refuses a membership in another organization', async () => {
    await db
      .getRepository(EnterpriseMembership)
      .save({ userId: 2, organizationId: 99, role: 'admin' as any, team: '' });
    expect(await allowed(shareWrite())).toBe(false);
  });

  it('refuses a role it does not know', async () => {
    await setRole('owner');
    expect(await allowed(commentWrite('comments:write'))).toBe(false);
    expect(await allowed(shareWrite())).toBe(false);
  });

  it('applies a demotion to the next write although the token is still valid', async () => {
    await setRole('editor');
    expect(await allowed(shareWrite())).toBe(true);
    await setRole('viewer');
    expect(await allowed(shareWrite())).toBe(false);
    await setRole('editor');
    expect(await allowed(shareWrite())).toBe(true);
  });

  it('checks the grant first: an invalid grant stays unauthorized, not forbidden', async () => {
    await setRole('viewer');
    assertGrant.mockRejectedValue(new UnauthorizedException());
    await expect(shareWrite().beforeAccess(db.manager)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(assertGrant).toHaveBeenCalledWith(db.manager, principal, 'shares:write');
  });

  it('attributes a share to the connection', () => {
    expect(shareWrite().ai).toEqual({ grantId: 'grant-1', clientName: 'Claude Code' });
  });
});
