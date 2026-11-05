import { roleAllows } from '../enterprise/role-capabilities';
import { MCP_SCOPES } from './config';
import { MCP_SCOPE_POLICY, mcpScopeKind, mcpScopeKinds } from './scope-policy';

/**
 * The expected table is written out by hand. Deriving it from MCP_SCOPE_POLICY would make the test
 * agree with whatever the policy says, including a scope that quietly lost its grade check.
 */
const EXPECTED = {
  'sources:read': { kind: 'read', capability: 'read' },
  'documents:read': { kind: 'read', capability: 'read' },
  'reports:read': { kind: 'read', capability: 'read' },
  'comments:read': { kind: 'read', capability: 'read' },
  'comments:write': { kind: 'write', capability: 'comment' },
  'suggestions:write': { kind: 'write', capability: 'comment' },
  'shares:write': { kind: 'write', capability: 'share' },
} as const;

describe('MCP scope policy', () => {
  it('has exactly the scopes the server knows, each with a kind and a grade capability', () => {
    expect(Object.keys(MCP_SCOPE_POLICY).sort()).toEqual([...MCP_SCOPES].sort());
    expect(MCP_SCOPE_POLICY).toEqual(EXPECTED);
  });

  it('classifies every scope that changes something as a write or delete, never by its name', () => {
    // A scope named like a read but allowed to change data would be selected by default on the
    // consent screen; the kind, not the suffix, decides.
    for (const scope of MCP_SCOPES) {
      const { kind, capability } = MCP_SCOPE_POLICY[scope];
      if (kind === 'read') expect(capability).toBe('read');
      else expect(['comment', 'write', 'share', 'publish', 'export']).toContain(capability);
    }
  });

  it('keeps a viewer away from sharing and lets only the grades that may do it use a scope', () => {
    const viewer = (scope: (typeof MCP_SCOPES)[number]) =>
      roleAllows('viewer', MCP_SCOPE_POLICY[scope].capability);
    expect(viewer('sources:read')).toBe(true);
    expect(viewer('comments:write')).toBe(true);
    expect(viewer('shares:write')).toBe(false);
    expect(roleAllows('contributor', MCP_SCOPE_POLICY['shares:write'].capability)).toBe(false);
    expect(roleAllows('editor', MCP_SCOPE_POLICY['shares:write'].capability)).toBe(true);
  });

  it('reports the kind of each requested scope for the consent screen', () => {
    expect(mcpScopeKind('shares:write')).toBe('write');
    expect(mcpScopeKinds(['sources:read', 'comments:write'])).toEqual({
      'sources:read': 'read',
      'comments:write': 'write',
    });
  });
});
