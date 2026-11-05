import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { ROUTE_CAPABILITY_VALUES, RouteCapability } from '../auth/route-capabilities';
import {
  ENTERPRISE_ROLES,
  EnterpriseRole,
  isMemberRole,
  normalizeRole,
  roleAllows,
} from './role-capabilities';

// Written out by hand, independent of the implementation, so the test cannot repeat a mistake in it.
// Rows are capabilities; columns are admin, editor, contributor, viewer.
const EXPECTED: Record<RouteCapability, [boolean, boolean, boolean, boolean]> = {
  read: [true, true, true, true],
  comment: [true, true, true, true],
  personal: [true, true, true, true],
  write: [true, true, true, false],
  source: [true, true, true, false],
  publish: [true, true, false, false],
  share: [true, true, false, false],
  export: [true, true, false, false],
  manage: [true, false, false, false],
  operator: [true, true, true, true],
  service: [true, true, true, true],
  'own-account': [true, true, true, true],
  public: [true, true, true, true],
};
const COLUMNS: EnterpriseRole[] = ['admin', 'editor', 'contributor', 'viewer'];

describe('organization roles', () => {
  it('lists the four grades in order', () => {
    expect([...ENTERPRISE_ROLES]).toEqual(COLUMNS);
  });

  describe('normalizeRole', () => {
    it.each(COLUMNS)('keeps %s', role => expect(normalizeRole(role)).toBe(role));

    it('reads the legacy member as editor', () => {
      expect(normalizeRole('member')).toBe('editor');
    });

    it.each([undefined, null, '', 'owner', 'ADMIN', 'Member', 0, {}, ['admin']])(
      'rejects %p',
      value => expect(normalizeRole(value)).toBeUndefined(),
    );
  });

  describe('isMemberRole', () => {
    it.each(['admin', 'editor', 'contributor', 'viewer', 'member'])('accepts %s', role =>
      expect(isMemberRole(role)).toBe(true),
    );
    it.each([undefined, null, '', 'owner', 'guest'])('rejects %p', value =>
      expect(isMemberRole(value)).toBe(false),
    );
  });

  describe('capability table', () => {
    it('has an expectation for every capability the routes use', () => {
      expect(Object.keys(EXPECTED).sort()).toEqual([...ROUTE_CAPABILITY_VALUES].sort());
    });

    it.each(ROUTE_CAPABILITY_VALUES)('%s matches the plan for all four grades', capability => {
      const actual = COLUMNS.map(role => roleAllows(role, capability));
      expect(actual).toEqual(EXPECTED[capability]);
    });

    it('gives the legacy member exactly what an editor has', () => {
      for (const capability of ROUTE_CAPABILITY_VALUES)
        expect(roleAllows('member', capability)).toBe(roleAllows('editor', capability));
    });

    it('lets an unknown role do nothing, not even read', () => {
      for (const capability of ROUTE_CAPABILITY_VALUES) {
        expect(roleAllows('owner', capability)).toBe(false);
        expect(roleAllows(undefined, capability)).toBe(false);
      }
    });

    it('lets only admin manage members, and viewers neither write nor publish', () => {
      expect(COLUMNS.filter(role => roleAllows(role, 'manage'))).toEqual(['admin']);
      expect(roleAllows('viewer', 'write')).toBe(false);
      expect(roleAllows('viewer', 'publish')).toBe(false);
      expect(roleAllows('contributor', 'publish')).toBe(false);
    });
  });

  // A literal list of grades goes stale when a grade is added: the new grade is then refused
  // silently. Allow-lists must use isMemberRole, so a spelled-out list is a defect.
  it('has no spelled-out list of member roles outside this module', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== 'node_modules' && name !== 'migrations') walk(path);
        } else if (
          name.endsWith('.ts') &&
          !name.endsWith('.spec.ts') &&
          !path.endsWith(join('enterprise', 'role-capabilities.ts'))
        ) {
          if (/\[\s*'admin'\s*,\s*'member'\s*\]/.test(readFileSync(path, 'utf8')))
            offenders.push(path);
        }
      }
    };
    walk(join(__dirname, '..'));
    expect(offenders).toEqual([]);
  });
});
