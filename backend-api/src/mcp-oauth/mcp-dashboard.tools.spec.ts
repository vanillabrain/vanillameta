jest.mock('ai', () => ({ generateText: jest.fn(), streamText: jest.fn(), tool: jest.fn() }));
jest.mock('@ai-sdk/provider', () => ({}));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
import { ForbiddenException } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { DashboardToolException } from './mcp-dashboard.errors';
import { buildMcpServer } from './mcp-server';
import type { McpScope } from './config';
import type { McpOAuthPrincipal } from './mcp-oauth.service';

const RID = '5f0d3a6e-8c57-4a2b-9d51-0d6a5b1c7e42';
const HEX = 'a'.repeat(64);
const principal = (scopes: McpScope[]): McpOAuthPrincipal => ({
  actorId: 2,
  authVersion: 0,
  grantId: 'grant',
  organizationId: 1,
  clientName: 'Synthetic AI',
  scopes,
});
const ALL: McpScope[] = ['dashboards:read', 'dashboards:write', 'dashboards:delete'];

describe('dashboard tools of the remote MCP server', () => {
  const service = {
    list: jest.fn(),
    read: jest.fn(),
    preview: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    restore: jest.fn(),
    removalImpact: jest.fn(),
    remove: jest.fn(),
  };
  const auth = { revalidate: jest.fn() };
  const sessions: Array<{ close(): Promise<void> }> = [];
  beforeEach(() => {
    for (const fn of Object.values(service)) fn.mockReset();
    auth.revalidate.mockReset().mockResolvedValue(undefined);
  });
  afterEach(async () => {
    while (sessions.length) await sessions.pop().close();
  });

  async function open(scopes: McpScope[]) {
    const server = buildMcpServer(principal(scopes), {
      auth: auth as never,
      read: {} as never,
      reports: {} as never,
      dashboards: service as never,
    });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'spec', version: '1.0.0' });
    await server.connect(serverSide);
    await client.connect(clientSide);
    sessions.push({
      async close() {
        await client.close();
        await server.close();
      },
    });
    const tools = (await client.listTools()).tools;
    const call = async (name: string, args: Record<string, unknown>) => {
      try {
        const result: any = await client.callTool({ name, arguments: args });
        const text = result.content[0].text as string;
        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          json = undefined;
        }
        return { isError: !!result.isError, text, json };
      } catch (error) {
        return { isError: true, text: String(error), json: undefined as any, rejected: true };
      }
    };
    return { tools, call };
  }

  it('lists a tool only for the scope that names it', async () => {
    const names = async (scopes: McpScope[]) =>
      (await open(scopes)).tools.map(tool => tool.name).sort();
    expect(await names(['dashboards:read'])).toEqual(['vm_list_dashboards', 'vm_read_dashboard']);
    expect(await names(['dashboards:write'])).toEqual([
      'vm_create_dashboard',
      'vm_preview_dashboard',
      'vm_restore_dashboard',
      'vm_update_dashboard',
    ]);
    expect(await names(['dashboards:delete'])).toEqual([
      'vm_get_dashboard_removal',
      'vm_remove_dashboard',
    ]);
    expect(await names(['sources:read'])).not.toContain('vm_remove_dashboard');
    expect(await names(ALL)).toHaveLength(8);
  });

  it('marks what removes or overwrites as destructive, and nothing reaches beyond this server', async () => {
    const { tools } = await open(ALL);
    const by = (name: string) => tools.find(tool => tool.name === name);
    for (const name of ['vm_update_dashboard', 'vm_restore_dashboard', 'vm_remove_dashboard'])
      expect(by(name).annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      });
    expect(by('vm_create_dashboard').annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    });
    for (const name of [
      'vm_list_dashboards',
      'vm_read_dashboard',
      'vm_preview_dashboard',
      'vm_get_dashboard_removal',
    ])
      expect(by(name).annotations).toMatchObject({ readOnlyHint: true });
    for (const tool of tools) expect(tool.annotations.openWorldHint).toBe(false);
    for (const name of [
      'vm_create_dashboard',
      'vm_update_dashboard',
      'vm_restore_dashboard',
      'vm_remove_dashboard',
    ]) {
      expect(by(name).inputSchema.required).toEqual(
        expect.arrayContaining(['requestId', 'confirmWrite']),
      );
      expect((by(name).inputSchema as any).additionalProperties).toBe(false);
    }
    expect(by('vm_remove_dashboard').description).toContain('vm_get_dashboard_removal');
    expect(by('vm_restore_dashboard').description).toContain('expectedSourceRevision');
    expect(by('vm_read_dashboard').description).toContain('baseline');
  });

  it('passes input to the service without confirmWrite and returns its result', async () => {
    const { call } = await open(ALL);
    service.update.mockResolvedValue({ dashboardId: 5, revision: HEX, changed: true });
    const changes = [{ type: 'renameDashboard', title: 'New' }];
    const result = await call('vm_update_dashboard', {
      dashboardId: 5,
      expectedRevision: HEX,
      expectedSourceRevision: HEX,
      changes,
      requestId: RID,
      confirmWrite: true,
    });
    expect(result.json).toEqual({ dashboardId: 5, revision: HEX, changed: true });
    expect(service.update).toHaveBeenCalledWith(expect.objectContaining({ actorId: 2 }), {
      dashboardId: 5,
      expectedRevision: HEX,
      expectedSourceRevision: HEX,
      changes,
      requestId: RID,
    });
  });

  it('rejects malformed input before the service is called', async () => {
    const { call } = await open(ALL);
    const base = {
      dashboardId: 5,
      expectedRevision: HEX,
      expectedSourceRevision: HEX,
      changes: [{ type: 'renameDashboard', title: 'x' }],
      requestId: RID,
      confirmWrite: true,
    };
    for (const bad of [
      { ...base, confirmWrite: false },
      { ...base, confirmWrite: undefined },
      { ...base, requestId: '5f0d3a6e-8c57-1a2b-9d51-0d6a5b1c7e42' },
      { ...base, extra: 1 },
      { ...base, expectedRevision: 'short' },
      { ...base, changes: [] },
      { ...base, dashboardId: 0 },
    ]) {
      const result = await call('vm_update_dashboard', bad as never);
      expect(result.isError).toBe(true);
    }
    expect(service.update).not.toHaveBeenCalled();
  });

  it('lets a change or block the rules refuse reach the server, so it is UNSUPPORTED_CHANGE and not a typo', async () => {
    const { call } = await open(ALL);
    service.update.mockRejectedValue(new DashboardToolException('INVALID', 'UNSUPPORTED_CHANGE'));
    service.preview.mockRejectedValue(new DashboardToolException('INVALID', 'UNSUPPORTED_CHANGE'));
    const update = await call('vm_update_dashboard', {
      dashboardId: 5,
      expectedRevision: HEX,
      expectedSourceRevision: HEX,
      changes: [
        { type: 'addBlock', block: { id: 'new:x' } },
        { type: 'updateBlock', blockId: 'b', patch: { measureRefs: [] } },
      ],
      requestId: RID,
      confirmWrite: true,
    });
    expect(update.json.error).toMatchObject({
      code: 'INVALID',
      retryable: false,
      detail: { reason: 'UNSUPPORTED_CHANGE' },
    });
    expect(service.update).toHaveBeenCalledTimes(1);
    const preview = await call('vm_preview_dashboard', {
      sourceId: 1,
      title: 'Formula',
      blocks: [
        { title: 'F', kind: 'BOARD_NUMERIC', metric: { kind: 'FORMULA', expression: 'a/b' } },
      ],
    });
    expect(preview.json.error.detail.reason).toBe('UNSUPPORTED_CHANGE');
    expect(service.preview).toHaveBeenCalledTimes(1);
  });

  it('returns the dependencies of a refused removal as kind and count only, not retryable', async () => {
    const { call } = await open(ALL);
    service.remove.mockRejectedValue(
      new DashboardToolException('INVALID', 'HAS_DEPENDENCIES', 'HAS_DEPENDENCIES', {
        dependencies: [{ kind: 'liveShare', count: 1 }],
      }),
    );
    const result = await call('vm_remove_dashboard', {
      dashboardId: 5,
      expectedRevision: HEX,
      requestId: RID,
      confirmWrite: true,
    });
    expect(result.json.error).toMatchObject({
      code: 'INVALID',
      retryable: false,
      detail: { reason: 'HAS_DEPENDENCIES', dependencies: [{ kind: 'liveShare', count: 1 }] },
    });
    expect(result.json.error.message).toContain('HAS_DEPENDENCIES');
    // A conflict on a dashboard sends the agent to the dashboard tools, not to the report ones.
    service.update.mockRejectedValueOnce(
      new DashboardToolException('CONFLICT', 'REVISION_CHANGED'),
    );
    const conflict = await call('vm_update_dashboard', {
      dashboardId: 5,
      expectedRevision: HEX,
      expectedSourceRevision: HEX,
      changes: [{ type: 'renameDashboard', title: 'x' }],
      requestId: RID,
      confirmWrite: true,
    });
    expect(conflict.json.error).toMatchObject({
      code: 'CONFLICT',
      retryable: true,
      detail: { reason: 'REVISION_CHANGED' },
    });
    expect(conflict.json.error.message).toContain('vm_read_dashboard');
    const reused = await (async () => {
      service.create.mockRejectedValueOnce(
        new DashboardToolException('REQUEST_REUSED', 'REQUEST_REUSED'),
      );
      return call('vm_create_dashboard', {
        sourceId: 1,
        title: 'T',
        blocks: [{ title: 'B', kind: 'BOARD_NUMERIC', metric: { id: 1, definitionVersion: 1 } }],
        previewDigest: HEX,
        expectedSourceRevision: HEX,
        requestId: RID,
        confirmWrite: true,
      });
    })();
    expect(reused.json.error.message).toContain('vm_read_dashboard');
  });

  it('reports a refusal of rights and a rate limit as codes, and a read error without a write note', async () => {
    const { call } = await open(ALL);
    service.create.mockRejectedValueOnce(new ForbiddenException());
    const forbidden = await call('vm_create_dashboard', {
      sourceId: 1,
      title: 'T',
      blocks: [{ title: 'B', kind: 'BOARD_NUMERIC', metric: { id: 1, definitionVersion: 1 } }],
      previewDigest: HEX,
      expectedSourceRevision: HEX,
      requestId: RID,
      confirmWrite: true,
    });
    expect(forbidden.json.error.code).toBe('FORBIDDEN');
    expect(forbidden.json.error.message).toContain('This call made no change.');
    service.list.mockRejectedValueOnce(new DashboardToolException('LIMIT', 'RATE_LIMITED'));
    const limited = await call('vm_list_dashboards', {});
    expect(limited.json.error).toMatchObject({
      code: 'LIMIT',
      retryable: true,
      detail: { reason: 'RATE_LIMITED' },
    });
    expect(limited.json.error.message).not.toContain('made no change');
  });

  it('gives read tools the dashboard history cursor', async () => {
    const { call } = await open(ALL);
    service.read.mockResolvedValue({ dashboardId: 5, history: [], historyNext: null });
    await call('vm_read_dashboard', { dashboardId: 5, historyBefore: 40 });
    expect(service.read).toHaveBeenCalledWith(expect.anything(), 5, 40);
    await call('vm_read_dashboard', { dashboardId: 5 });
    expect(service.read).toHaveBeenLastCalledWith(expect.anything(), 5, undefined);
  });
});
