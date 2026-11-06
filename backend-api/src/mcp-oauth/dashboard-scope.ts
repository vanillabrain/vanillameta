import type { RouteCapability } from '../auth/route-capabilities';
import type { McpScopeKind } from './scope-policy';

/**
 * The scopes of the dashboard tools. They are NOT in `McpScope` yet, so no client can be registered
 * with them and no consent screen can grant them: the service in this step is complete but cannot
 * be reached by a real connection. The step that registers the tools (1b-7) moves these three into
 * `McpScope` and `MCP_SCOPE_POLICY`, and this file goes away.
 *
 * Deleting is a `write` capability, as the HTTP delete route is.
 */
export type DashboardScope = 'dashboards:read' | 'dashboards:write' | 'dashboards:delete';

export const DASHBOARD_SCOPE_POLICY: Readonly<
  Record<DashboardScope, { kind: McpScopeKind; capability: RouteCapability }>
> = {
  'dashboards:read': { kind: 'read', capability: 'read' },
  'dashboards:write': { kind: 'write', capability: 'write' },
  'dashboards:delete': { kind: 'delete', capability: 'write' },
};
