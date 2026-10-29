import { afterEach, expect, it, vi } from 'vitest';
import { get, post } from '@/helpers/apiHelper';
import { documentService, validateGoogleAuthorizationUrl } from '@/api/documentService';

vi.mock('@/helpers/apiHelper', () => ({ get: vi.fn(), post: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const id = 'c409a190-a727-4e65-8d9f-a2bc013966fd';
const requestId = '1f7f988b-8011-4293-9bda-dba12b18b7b2';
const sourceUrl = 'https://docs.google.com/document/d/abcdefghij12345/edit';
const result = { documentId: id, version: 1, unchanged: false };

it('unwraps Axios response.data without a SUCCESS envelope', async () => {
  vi.mocked(get).mockResolvedValue({ data: { configured: true, organizationId: null, documents: [] } });
  expect(await documentService.list()).toEqual({ configured: true, organizationId: null, documents: [] });
  vi.mocked(get).mockResolvedValue({
    data: { status: 'SUCCESS', data: { configured: true, organizationId: null, documents: [] } },
  });
  await expect(documentService.list()).rejects.toThrow();
});
it.each([
  'https://accounts.google.com.evil.test/o/oauth2/v2/auth',
  'javascript:alert(1)',
  'http://accounts.google.com/o/oauth2/v2/auth',
  'https://evil.test/o/oauth2/v2/auth',
  'https://accounts.google.com/redirect',
  'https://user@accounts.google.com/o/oauth2/v2/auth',
  'https://accounts.google.com:444/o/oauth2/v2/auth',
])('rejects unpinned authorization redirect %s', async authorizationUrl => {
  vi.mocked(post).mockResolvedValue({ data: { authorizationUrl } });
  await expect(documentService.start({ sourceUrl })).rejects.toThrow();
});
it('accepts only the pinned Google authorization endpoint and validates the source before POST', async () => {
  const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=selected-file';
  expect(validateGoogleAuthorizationUrl(authorizationUrl)).toBe(authorizationUrl);
  await expect(documentService.start({ sourceUrl: 'https://example.com/document' })).rejects.toThrow();
  expect(post).not.toHaveBeenCalled();
  vi.mocked(post).mockResolvedValue({ data: { authorizationUrl } });
  expect(await documentService.start({ sourceUrl, documentId: id })).toBe(authorizationUrl);
  expect(post).toHaveBeenCalledWith('/documents/google/start', { sourceUrl, documentId: id }, { _retry: true });
});
it('uses a 90 second refresh timeout, exact request body and no interceptor write retry', async () => {
  vi.mocked(post).mockResolvedValue({ data: result });
  expect(await documentService.refresh(id, { requestId, expectedVersion: 0 })).toEqual(result);
  expect(post).toHaveBeenCalledWith(
    `/documents/${id}/refresh`,
    { requestId, expectedVersion: 0 },
    { timeout: 90000, _retry: true },
  );
  vi.mocked(get).mockResolvedValue({ data: { status: 'completed', result } });
  expect(await documentService.request(id, requestId)).toEqual({ status: 'completed', result });
  expect(get).toHaveBeenCalledWith(`/documents/${id}/requests/${requestId}`);
});
it('rejects mismatched receipts and incomplete completion results', async () => {
  vi.mocked(post).mockResolvedValue({ data: { ...result, documentId: requestId } });
  await expect(documentService.refresh(id, { requestId, expectedVersion: 0 })).rejects.toThrow();
  vi.mocked(get).mockResolvedValue({ data: { status: 'completed' } });
  await expect(documentService.request(id, requestId)).rejects.toThrow();
});
it('posts callback secrets once without returning provider credentials', async () => {
  vi.mocked(post).mockResolvedValue({ data: { documentId: id } });
  const input = { code: 'private-code', state: 'session-state', pickedFileIds: 'abcdefghij12345' };
  expect(await documentService.complete(input)).toBe(id);
  expect(post).toHaveBeenCalledExactlyOnceWith('/documents/google/complete', input, { timeout: 90000, _retry: true });
});
