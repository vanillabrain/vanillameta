import type { RouteCapability } from '../auth/route-capabilities';

/**
 * Organization roles. `admin` manages members and grants; the other three differ in what they may
 * change. `member` is the legacy value written before roles had grades: it is read as `editor` (the
 * old member could create, edit, publish and export their own artifacts) and is never written by
 * new code.
 */
export const ENTERPRISE_ROLES = ['admin', 'editor', 'contributor', 'viewer'] as const;
export type EnterpriseRole = (typeof ENTERPRISE_ROLES)[number];

/** What `enterprise_membership.role` may hold in a database: a grade, or the legacy `member`. */
export type StoredRole = EnterpriseRole | 'member';

export const LEGACY_MEMBER_ROLE = 'member' as const;

/** Reads a stored value as a grade. Anything that is not a known role or the legacy alias is undefined. */
export function normalizeRole(value: unknown): EnterpriseRole | undefined {
  if (value === LEGACY_MEMBER_ROLE) return 'editor';
  return (ENTERPRISE_ROLES as readonly unknown[]).includes(value)
    ? (value as EnterpriseRole)
    : undefined;
}

/**
 * True for any value that names an organization member, old or new. Allow-lists use this so that a
 * newly added grade is never refused for not being spelled out in a literal list.
 */
export function isMemberRole(value: unknown): boolean {
  return normalizeRole(value) !== undefined;
}

const READ_ONLY: RouteCapability[] = ['read', 'comment', 'personal'];
// Routes whose own service decides who may act, plus accounts and anonymous endpoints: the grade
// never refuses these, so a grade restriction cannot lock someone out of their own account.
const PASS_THROUGH: RouteCapability[] = ['service', 'operator', 'own-account', 'public'];
const DRAFTING: RouteCapability[] = ['write', 'source'];
const PUBLISHING: RouteCapability[] = ['publish', 'share', 'export'];

/** Which route capabilities each grade may use. Mirrors the table in docs/plans/ai-native-artifacts-1a.md. */
export const ROLE_CAPABILITIES: Readonly<Record<EnterpriseRole, ReadonlySet<RouteCapability>>> = {
  viewer: new Set([...READ_ONLY, ...PASS_THROUGH]),
  contributor: new Set([...READ_ONLY, ...DRAFTING, ...PASS_THROUGH]),
  editor: new Set([...READ_ONLY, ...DRAFTING, ...PUBLISHING, ...PASS_THROUGH]),
  admin: new Set([...READ_ONLY, ...DRAFTING, ...PUBLISHING, 'manage', ...PASS_THROUGH]),
};

/** True when the stored role may use the capability. An unknown role may use nothing. */
export function roleAllows(role: unknown, capability: RouteCapability): boolean {
  const grade = normalizeRole(role);
  return grade !== undefined && ROLE_CAPABILITIES[grade].has(capability);
}
