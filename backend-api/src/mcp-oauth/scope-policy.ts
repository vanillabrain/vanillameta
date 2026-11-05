import type { RouteCapability } from '../auth/route-capabilities';
import { McpScope } from './config';

/**
 * What each OAuth scope allows, in one place.
 *
 * `kind` is how the consent screen groups and defaults a scope: only `read` is selected by default,
 * `write` and `delete` start unchecked. `capability` is the account's grade capability the scope
 * needs (enterprise/role-capabilities): a connection acts with the account's own rights, so a scope
 * the user approved is a ceiling and the grade is a second one.
 *
 * Today only the write scopes' capability is enforced (`McpReportService.assertGrade`). The read
 * scopes carry `read` so the table is complete; enforcing it on reads is 1b-4. Membership is already
 * checked on every call by `McpOAuthService.revalidate`.
 *
 * The record is exhaustive on purpose. A scope added to `McpScope` without an entry here does not
 * compile, so a new scope can neither skip the grade check nor be selected by default by accident.
 * A scope whose meaning later grows (a wider write, a publish) is a new scope name: approved grants
 * are not asked again, so widening an existing one would widen every connection already made.
 */
export type McpScopeKind = 'read' | 'write' | 'delete';

export const MCP_SCOPE_POLICY: Readonly<
  Record<McpScope, { kind: McpScopeKind; capability: RouteCapability }>
> = {
  'sources:read': { kind: 'read', capability: 'read' },
  'documents:read': { kind: 'read', capability: 'read' },
  'reports:read': { kind: 'read', capability: 'read' },
  'comments:read': { kind: 'read', capability: 'read' },
  'comments:write': { kind: 'write', capability: 'comment' },
  'suggestions:write': { kind: 'write', capability: 'comment' },
  'shares:write': { kind: 'write', capability: 'share' },
};

export const mcpScopeKind = (scope: McpScope): McpScopeKind => MCP_SCOPE_POLICY[scope].kind;

/** The kind of every scope in the list, for the consent screen. */
export function mcpScopeKinds(scopes: readonly McpScope[]): Record<string, McpScopeKind> {
  return Object.fromEntries(scopes.map(scope => [scope, mcpScopeKind(scope)]));
}
