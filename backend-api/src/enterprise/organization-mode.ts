import { signupMode } from '../access/access.service';

/** Name of the organization created for the bootstrap administrator when a seed does it. */
export const BOOTSTRAP_ORGANIZATION_NAME = 'VanillaMeta';

const LOGIN_ID_MAX_LENGTH = 255;

/**
 * The login id that may create the organization. When it is set the installation is "managed":
 * only that account creates the one organization, and an account outside an organization cannot
 * use the service. Unset (or blank) keeps the open behaviour of earlier versions.
 */
export function bootstrapAdminLoginId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const value = env.BOOTSTRAP_ADMIN_USER_ID?.trim();
  return value ? value : undefined;
}

export function isManagedMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return bootstrapAdminLoginId(env) !== undefined;
}

export interface OrganizationModeFacts {
  /** Whether an account with the bootstrap login id exists. Unknown (undefined) skips that check. */
  bootstrapUserExists?: boolean;
}

/**
 * Problems that make a managed boot unsafe. Names only; no account data is echoed. If the account
 * does not exist yet and anyone may register, whoever registers that login id first becomes the
 * administrator, so that combination is refused.
 */
export function organizationModeProblems(
  env: NodeJS.ProcessEnv,
  facts: OrganizationModeFacts = {},
): string[] {
  const value = bootstrapAdminLoginId(env);
  if (value === undefined) return [];
  const problems: string[] = [];
  if (value.length > LOGIN_ID_MAX_LENGTH || /[\s\u0000-\u001f]/.test(value))
    problems.push(
      `BOOTSTRAP_ADMIN_USER_ID must be one login id without spaces, at most ${LOGIN_ID_MAX_LENGTH} characters`,
    );
  if (facts.bootstrapUserExists === false && signupMode(env) === 'open')
    problems.push(
      'BOOTSTRAP_ADMIN_USER_ID names an account that does not exist while SIGNUP_MODE is open: ' +
        'whoever registers that login id first would become the administrator; ' +
        'create the account first or set SIGNUP_MODE=invite or closed',
    );
  return problems;
}

export function assertOrganizationMode(
  env: NodeJS.ProcessEnv = process.env,
  facts: OrganizationModeFacts = {},
): void {
  const problems = organizationModeProblems(env, facts);
  if (problems.length) throw new Error(`Unsafe organization setup:\n- ${problems.join('\n- ')}`);
}

/**
 * Whether the account may create the organization right now. In the open mode anyone may (the
 * earlier behaviour). In the managed mode only the bootstrap account may, and only while no
 * organization exists.
 */
export function mayCreateOrganization(
  loginId: string,
  organizationCount: number,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const bootstrap = bootstrapAdminLoginId(env);
  if (bootstrap === undefined) return true;
  return loginId === bootstrap && organizationCount === 0;
}
