import { describe, expect, it } from 'vitest';
import { organizationRequiredRedirect } from './apiHelper';

const body = (code: string) => ({
  success: false,
  code: 403,
  data: { statusCode: 403, code, message: '조직에 연결된 뒤에 사용할 수 있습니다.' },
});

describe('organizationRequiredRedirect', () => {
  it('sends an account that belongs to no organization to the organization page', () => {
    expect(organizationRequiredRedirect(403, body('ORGANIZATION_REQUIRED'), '/dashboard')).toBe('/organization');
    expect(organizationRequiredRedirect(403, body('ORGANIZATION_REQUIRED'), '/')).toBe('/organization');
  });

  it('reads the code at the top level of the body as well', () => {
    expect(organizationRequiredRedirect(403, { code: 'ORGANIZATION_REQUIRED' }, '/reports')).toBe('/organization');
  });

  it('does not send anyone away from the organization page, so it cannot loop', () => {
    expect(organizationRequiredRedirect(403, body('ORGANIZATION_REQUIRED'), '/organization')).toBeNull();
    expect(organizationRequiredRedirect(403, body('ORGANIZATION_REQUIRED'), '/organization/members')).toBeNull();
  });

  it('keeps a page that merely starts with the same letters', () => {
    expect(organizationRequiredRedirect(403, body('ORGANIZATION_REQUIRED'), '/organizations')).toBe('/organization');
  });

  it.each([
    ['a refusal by grade', 403, body('ROLE_FORBIDDEN')],
    ['an unclassified route', 403, body('ROUTE_UNCLASSIFIED')],
    ['another status', 401, body('ORGANIZATION_REQUIRED')],
    ['no body', 403, undefined],
    ['a string body', 403, 'Forbidden'],
    ['a null body', 403, null],
  ])('leaves %s alone', (_name, status, data) => {
    expect(organizationRequiredRedirect(status, data, '/dashboard')).toBeNull();
  });
});
