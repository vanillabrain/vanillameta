import {
  assertOrganizationMode,
  bootstrapAdminLoginId,
  isManagedMode,
  mayCreateOrganization,
  organizationModeProblems,
} from './organization-mode';

const env = (values: Record<string, string | undefined>) => values as NodeJS.ProcessEnv;

describe('organization mode', () => {
  describe('bootstrapAdminLoginId', () => {
    it.each([
      [undefined, undefined],
      ['', undefined],
      ['   ', undefined],
      ['guest', 'guest'],
      ['  guest  ', 'guest'],
    ])('reads %p as %p', (value, expected) => {
      expect(bootstrapAdminLoginId(env({ BOOTSTRAP_ADMIN_USER_ID: value }))).toBe(expected);
    });

    it('is managed exactly when a login id is set', () => {
      expect(isManagedMode(env({}))).toBe(false);
      expect(isManagedMode(env({ BOOTSTRAP_ADMIN_USER_ID: ' ' }))).toBe(false);
      expect(isManagedMode(env({ BOOTSTRAP_ADMIN_USER_ID: 'guest' }))).toBe(true);
    });
  });

  describe('mayCreateOrganization', () => {
    it('lets anyone create in the open mode, as before', () => {
      expect(mayCreateOrganization('anyone', 0, env({}))).toBe(true);
      expect(mayCreateOrganization('anyone', 5, env({}))).toBe(true);
    });

    it('lets only the bootstrap account create, and only while there is none', () => {
      const managed = env({ BOOTSTRAP_ADMIN_USER_ID: 'guest' });
      expect(mayCreateOrganization('guest', 0, managed)).toBe(true);
      expect(mayCreateOrganization('guest', 1, managed)).toBe(false);
      expect(mayCreateOrganization('someone', 0, managed)).toBe(false);
      expect(mayCreateOrganization('Guest', 0, managed)).toBe(false);
    });
  });

  describe('organizationModeProblems', () => {
    it('finds nothing when the mode is off', () => {
      expect(organizationModeProblems(env({}), { bootstrapUserExists: false })).toEqual([]);
    });

    it('accepts a managed setup whose account exists', () => {
      const managed = env({ BOOTSTRAP_ADMIN_USER_ID: 'guest', SIGNUP_MODE: 'open' });
      expect(organizationModeProblems(managed, { bootstrapUserExists: true })).toEqual([]);
    });

    it('does not check the account until it is known', () => {
      expect(
        organizationModeProblems(env({ BOOTSTRAP_ADMIN_USER_ID: 'guest', SIGNUP_MODE: 'open' })),
      ).toEqual([]);
    });

    it.each([
      ['open', 'open'],
      ['unset outside production (open by default)', undefined],
    ])('refuses a missing account while signup is %s', (_name, signup) => {
      const problems = organizationModeProblems(
        env({ BOOTSTRAP_ADMIN_USER_ID: 'guest', SIGNUP_MODE: signup, NODE_ENV: 'dev' }),
        { bootstrapUserExists: false },
      );
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/registers that login id first/);
    });

    it.each(['invite', 'closed', 'nonsense'])(
      'allows a missing account while signup is %s (an unknown value fails closed)',
      signup => {
        expect(
          organizationModeProblems(env({ BOOTSTRAP_ADMIN_USER_ID: 'guest', SIGNUP_MODE: signup }), {
            bootstrapUserExists: false,
          }),
        ).toEqual([]);
      },
    );

    it('allows a missing account in production, where signup defaults to invitation only', () => {
      expect(
        organizationModeProblems(env({ BOOTSTRAP_ADMIN_USER_ID: 'guest', NODE_ENV: 'prod' }), {
          bootstrapUserExists: false,
        }),
      ).toEqual([]);
    });

    it.each(['two words', 'tab\there', 'a'.repeat(256)])('refuses the login id %p', value => {
      const problems = organizationModeProblems(env({ BOOTSTRAP_ADMIN_USER_ID: value }));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/one login id/);
    });

    it('does not echo the login id', () => {
      const problems = organizationModeProblems(env({ BOOTSTRAP_ADMIN_USER_ID: 'secret name' }));
      expect(problems.join()).not.toContain('secret name');
    });

    it('throws a message that lists the problems', () => {
      expect(() =>
        assertOrganizationMode(env({ BOOTSTRAP_ADMIN_USER_ID: 'guest', SIGNUP_MODE: 'open' }), {
          bootstrapUserExists: false,
        }),
      ).toThrow(/Unsafe organization setup/);
    });
  });
});
