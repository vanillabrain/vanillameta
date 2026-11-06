jest.mock('ai', () => ({ generateText: jest.fn(), streamText: jest.fn(), tool: jest.fn() }));
jest.mock('@ai-sdk/provider', () => ({}));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DashboardDeletionService } from '../dashboard/dashboard-deletion.service';
import { StudioModule } from '../dashboard-studio/studio.module';
import { StudioCreationService } from '../dashboard-studio/studio-creation.service';
import { StudioService } from '../dashboard-studio/studio.service';
import { EnterpriseResourcePolicyService } from '../enterprise/resource-policy.service';
import { SourceOwnershipModule } from '../ownership/source-ownership.module';
import { McpDashboardService } from './mcp-dashboard.service';
import { McpOAuthModule } from './mcp-oauth.module';
import { McpOAuthService } from './mcp-oauth.service';
import { McpRemoteModule } from './mcp.controller';

/**
 * Booting the whole application graph is too heavy for a unit test, so this reads the module
 * metadata Nest itself resolves from: what McpDashboardService injects must be provided by its
 * module or exported by a module it imports, and must not be provided a second time.
 */
const meta = (module: unknown, key: 'imports' | 'providers' | 'exports'): unknown[] =>
  Reflect.getMetadata(key, module as object) ?? [];
const isGlobal = (module: unknown) => Reflect.getMetadata('__module:global__', module as object);

describe('McpRemoteModule wiring for the dashboard tools', () => {
  it('can resolve every constructor parameter of McpDashboardService', () => {
    const params: unknown[] = Reflect.getMetadata('design:paramtypes', McpDashboardService);
    expect(params).toEqual([
      DataSource,
      EnterpriseResourcePolicyService,
      StudioService,
      StudioCreationService,
      McpOAuthService,
      DashboardDeletionService,
    ]);
    const imported = meta(McpRemoteModule, 'imports');
    const reachable = new Set<unknown>([
      ...meta(McpRemoteModule, 'providers'),
      ...imported.flatMap(module => meta(module, 'exports')),
      // @Global modules reach every module without being imported.
      ...[SourceOwnershipModule].filter(isGlobal).flatMap(module => meta(module, 'exports')),
    ]);
    // The data source comes from the global TypeORM module, as for every other service.
    for (const param of params.filter(param => param !== DataSource))
      expect(reachable.has(param)).toBe(true);
    for (const module of [McpOAuthModule, StudioModule, DashboardModule])
      expect(imported).toContain(module);
  });

  it('shares the instances people use, so a connection and a person queue behind one write queue', () => {
    const own = meta(McpRemoteModule, 'providers');
    for (const service of [StudioService, StudioCreationService, DashboardDeletionService])
      expect(own).not.toContain(service);
    expect(own).toContain(McpDashboardService);
    expect(meta(StudioModule, 'providers')).toEqual(
      expect.arrayContaining([StudioService, StudioCreationService]),
    );
    expect(meta(StudioModule, 'exports')).toEqual(
      expect.arrayContaining([StudioService, StudioCreationService]),
    );
    expect(meta(DashboardModule, 'exports')).toContain(DashboardDeletionService);
  });
});
