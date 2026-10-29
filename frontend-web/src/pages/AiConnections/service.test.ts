import { beforeEach, expect, it, vi } from 'vitest';
import { get, post } from '@/helpers/apiHelper';
import { aiConnectionsService, ConsentRequest, validateDecisionRedirect } from '@/api/aiConnectionsService';
vi.mock('@/helpers/apiHelper', () => ({ get: vi.fn(), post: vi.fn() }));
const request: ConsentRequest = {
  ticket: 'a'.repeat(64),
  clientName: 'Test AI',
  clientId: 'test-ai',
  organization: { id: 1, name: 'Current org' },
  accountLabel: 'user@example.test',
  requestedScopes: ['sources:read', 'documents:read'],
  expiresAt: '2099-10-29T01:00:00.000Z',
  reviewToken: 'signed-review',
  redirectUri: 'https://ai.example/callback',
};
beforeEach(() => vi.resetAllMocks());
it('reads plain JSON using the consent cookie without posting', async () => {
  vi.mocked(get).mockResolvedValue({ data: request });
  expect(await aiConnectionsService.request(request.ticket)).toEqual(request);
  expect(get).toHaveBeenCalledWith(
    '/ai-connections/requests/' + request.ticket,
    undefined,
    expect.objectContaining({ withCredentials: true }),
  );
  expect(post).not.toHaveBeenCalled();
});
it('sends only reviewed subset and prevents automatic write retry', async () => {
  vi.mocked(post).mockResolvedValue({
    data: { approved: true, redirectUrl: request.redirectUri + '?code=opaque&state=original' },
  });
  await aiConnectionsService.decide(request, { decision: 'approve', scopes: ['sources:read'] });
  expect(post).toHaveBeenCalledWith(
    '/ai-connections/requests/' + request.ticket + '/decision',
    { decision: 'approve', scopes: ['sources:read'], reviewToken: request.reviewToken },
    { _retry: true, withCredentials: true },
  );
});
it('rejects empty approval or scopes not requested before POST', async () => {
  await expect(aiConnectionsService.decide(request, { decision: 'approve', scopes: [] })).rejects.toThrow();
  await expect(
    aiConnectionsService.decide(
      { ...request, requestedScopes: ['sources:read'] },
      { decision: 'approve', scopes: ['documents:read'] },
    ),
  ).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
});
it('cancel sends empty scopes and requires access_denied', async () => {
  vi.mocked(post).mockResolvedValue({
    data: { approved: false, redirectUrl: request.redirectUri + '?error=access_denied&state=original' },
  });
  expect(await aiConnectionsService.decide(request, { decision: 'cancel', scopes: [] })).toContain('access_denied');
  expect(post).toHaveBeenCalledWith(
    expect.any(String),
    { decision: 'cancel', scopes: [], reviewToken: request.reviewToken },
    expect.any(Object),
  );
});
it.each([
  'https://evil.test/callback?code=x&state=s',
  'https://ai.example/other?code=x&state=s',
  'https://user:pass@ai.example/callback?code=x&state=s',
  'https://ai.example/callback?code=x&state=s#fragment',
  'http://ai.example/callback?code=x&state=s',
  'javascript:alert(1)',
  '//ai.example/callback?code=x&state=s',
  'https://ai.example/callback?code=x&state=s&next=https://evil.test',
  'https://ai.example/callback?code=x&state=s&error_description=extra',
  'https://ai.example/callback?code=x&code=y&state=s',
  'https://ai.example/callback?code=x',
  'https://ai.example/callback?code=x&state=s&error=access_denied',
])('rejects unexpected navigation %s', value => {
  expect(() => validateDecisionRedirect(value, request.redirectUri, true)).toThrow();
});
it('supports exact loopback HTTP and preserves static callback query', () => {
  const url = 'http://127.0.0.1:8765/callback?fixed=1&code=x&state=s';
  expect(validateDecisionRedirect(url, 'http://127.0.0.1:8765/callback?fixed=1', true)).toBe(url);
  expect(() =>
    validateDecisionRedirect(url.replace('fixed=1', 'fixed=2'), 'http://127.0.0.1:8765/callback?fixed=1', true),
  ).toThrow();
});
it('rejects organization-mixed lists and write scopes', async () => {
  vi.mocked(get).mockResolvedValue({ data: { configured: false, resourceUrl: null, organization: null, connections: [] } });
  expect((await aiConnectionsService.list()).configured).toBe(false);
  vi.mocked(get).mockResolvedValue({ data: { ...request, requestedScopes: ['sources:write'] } });
  await expect(aiConnectionsService.request(request.ticket)).rejects.toThrow();
});
it('revokes only the selected grant with no retry or actor body', async () => {
  vi.mocked(post).mockResolvedValue({ data: { revoked: true } });
  await aiConnectionsService.disconnect('grant-id');
  expect(post).toHaveBeenCalledWith('/ai-connections/grant-id/disconnect', {}, { _retry: true, withCredentials: true });
});
