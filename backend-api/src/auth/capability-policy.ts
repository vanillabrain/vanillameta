import { roleAllows } from '../enterprise/role-capabilities';
import { ROUTE_CAPABILITIES, RouteCapability } from './route-capabilities';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Handlers an account outside any organization may still call in the managed mode: its own context
 * (so the client can tell it to wait), its own profile, the public read of a Studio publication, and
 * the routes that get it into an organization.
 */
export const ORGANIZATION_OPTIONAL_HANDLERS: ReadonlySet<string> = new Set([
  'EnterpriseController.context',
  // An account outside an organization issues (and withdraws) the code an administrator uses to add
  // it, and the bootstrap account creates the organization before it belongs to one.
  'EnterpriseController.enrollment',
  'EnterpriseController.revokeEnrollment',
  'EnterpriseController.create',
  'UserController.findOne',
  'StudioPublicationController.read',
]);

/** Whole controllers that do not need an enterprise organization: governance runs its own. */
export const ORGANIZATION_OPTIONAL_CONTROLLERS: ReadonlySet<string> = new Set([
  'GovernanceController',
]);

/** Capabilities whose routes never need an organization: operators, own account, anonymous. */
const ORGANIZATION_OPTIONAL_CAPABILITIES: ReadonlySet<RouteCapability> = new Set([
  'operator',
  'own-account',
  'public',
]);

export type DenialCode = 'ORGANIZATION_REQUIRED' | 'ROLE_FORBIDDEN';
export interface Denial {
  code: DenialCode;
  message: string;
}

export interface AccessInput {
  /** True when BOOTSTRAP_ADMIN_USER_ID is set: an account outside an organization may not use the service. */
  managed: boolean;
  controller: string;
  handler: string;
  method: string;
  /** The account's membership, or undefined when it belongs to no organization. */
  membership?: { role: unknown };
  /** Set by a guard subclass whose routes serve accounts outside an organization (operators). */
  organizationOptional?: boolean;
}

/**
 * The capability a request needs. A read verb is `read`. A write verb must be in the table; the
 * route-capabilities spec fails when one is not, so the fallback is only reached by a route the
 * production app does not mount. It takes the strictest capability (`manage`, administrators
 * only) so that an unclassified route is never open to a lower grade by accident.
 */
export function capabilityOf(controller: string, handler: string, method: string): RouteCapability {
  if (READ_METHODS.has(method.toUpperCase())) return 'read';
  return ROUTE_CAPABILITIES[`${controller}.${handler}`] ?? 'manage';
}

/**
 * Whether the account may make this request. Undefined means yes.
 *
 * - Anonymous or self-authenticating routes pass.
 * - Without a membership, the open mode behaves as before; the managed mode refuses everything
 *   except the routes that serve accounts outside an organization.
 * - With a membership the grade must allow the capability. A role this code does not know allows
 *   nothing, not even reading.
 */
export function deniedAccess(input: AccessInput): Denial | undefined {
  const capability = capabilityOf(input.controller, input.handler, input.method);
  if (capability === 'public') return undefined;
  if (!input.membership) {
    if (!input.managed) return undefined;
    const optional =
      input.organizationOptional === true ||
      ORGANIZATION_OPTIONAL_CAPABILITIES.has(capability) ||
      ORGANIZATION_OPTIONAL_HANDLERS.has(`${input.controller}.${input.handler}`) ||
      ORGANIZATION_OPTIONAL_CONTROLLERS.has(input.controller);
    return optional
      ? undefined
      : {
          code: 'ORGANIZATION_REQUIRED',
          message: '조직에 연결된 뒤에 사용할 수 있습니다. 조직 관리자에게 문의해 주세요.',
        };
  }
  return roleAllows(input.membership.role, capability)
    ? undefined
    : { code: 'ROLE_FORBIDDEN', message: '현재 등급으로는 이 작업을 할 수 없습니다.' };
}
