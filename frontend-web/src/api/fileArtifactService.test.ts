import { beforeEach, expect, it, vi } from 'vitest';
import { del, get, post, postForm } from '@/helpers/apiHelper';
import { fileArtifactService, fileUploadError } from './fileArtifactService';

const anonymousGet = vi.hoisted(() => vi.fn());
vi.mock('@/helpers/apiHelper', () => ({ get: vi.fn(), post: vi.fn(), postForm: vi.fn(), del: vi.fn() }));
vi.mock('axios', () => ({ create: () => ({ get: anonymousGet }) }));
const id = '11111111-1111-4111-8111-111111111111';
const item = {
  id,
  kind: 'html',
  title: 'Report',
  headVersion: 2,
  revision: 3,
  size: 128,
  mimeType: 'text/html',
  updatedAt: '2026-10-31T00:00:00.000Z',
  shareActive: false,
  safePreview: true,
};
const detail = {
  ...item,
  versions: [
    {
      version: 2,
      originalName: 'report.html',
      mimeType: 'text/html',
      byteSize: 128,
      sha256: 'a'.repeat(64),
      createdAt: '2026-10-31T00:00:00.000Z',
    },
  ],
};
beforeEach(() => vi.clearAllMocks());

it('uses the owner list/detail/content contract and validates responses', async () => {
  vi.mocked(get).mockResolvedValueOnce({ data: { items: [item] } });
  await expect(fileArtifactService.list()).resolves.toEqual([item]);
  vi.mocked(get).mockResolvedValueOnce({ data: detail });
  await expect(fileArtifactService.detail(id)).resolves.toEqual(detail);
  const blob = new Blob(['<p>ok</p>']);
  vi.mocked(get).mockResolvedValueOnce({ data: blob });
  await expect(fileArtifactService.content(id, 2)).resolves.toBe(blob);
  expect(vi.mocked(get).mock.calls[0][0]).toBe('/artifacts/files');
  expect(vi.mocked(get).mock.calls[1][0]).toBe(`/artifacts/files/${id}`);
  expect(vi.mocked(get).mock.calls[2][0]).toBe(`/artifacts/files/${id}/versions/2/content`);
});

it('sends exact multipart fields for upload and replace', async () => {
  vi.mocked(postForm).mockResolvedValueOnce({ data: detail });
  const file = new File(['x'], 'report.html', { type: 'text/html' });
  await fileArtifactService.upload(file, 'Quarterly');
  const body = vi.mocked(postForm).mock.calls[0][1];
  expect(vi.mocked(postForm).mock.calls[0][0]).toBe('/artifacts/files');
  expect(body.get('file')).toBe(file);
  expect(body.get('title')).toBe('Quarterly');
  vi.mocked(postForm).mockResolvedValueOnce({ data: detail });
  await fileArtifactService.replace(id, file, 2);
  expect(vi.mocked(postForm).mock.calls[1][0]).toBe(`/artifacts/files/${id}/versions`);
  expect(vi.mocked(postForm).mock.calls[1][1].get('expectedVersion')).toBe('2');
});

it('creates, revokes, deletes with CAS and reads public share paths', async () => {
  vi.mocked(post).mockResolvedValueOnce({ data: { token: 'branch.one', expiresAt: null } });
  await expect(fileArtifactService.share(id, '2026-11-01T00:00:00.000Z')).resolves.toEqual({
    token: 'branch.one',
    expiresAt: null,
  });
  expect(vi.mocked(post).mock.calls[0]).toEqual([
    `/artifacts/files/${id}/share`,
    { expiresAt: '2026-11-01T00:00:00.000Z' },
    { _retry: true },
  ]);
  await fileArtifactService.revoke(id);
  await fileArtifactService.remove(id, 3);
  expect(vi.mocked(del).mock.calls[0][0]).toBe(`/artifacts/files/${id}/share`);
  expect(vi.mocked(del).mock.calls[1][0]).toBe(`/artifacts/files/${id}`);
  expect(vi.mocked(del).mock.calls[1][1]).toEqual({ data: { expectedRevision: 3 }, _retry: true });
  anonymousGet.mockResolvedValueOnce({ data: item });
  await expect(fileArtifactService.shared('branch.one')).resolves.toEqual(item);
  const sharedBlob = new Blob(['shared']);
  anonymousGet.mockResolvedValueOnce({ data: sharedBlob });
  await expect(fileArtifactService.sharedContent('branch.one')).resolves.toBe(sharedBlob);
  expect(anonymousGet.mock.calls[0][0]).toBe('/artifacts/shared/branch.one');
  expect(anonymousGet.mock.calls[1][0]).toBe('/artifacts/shared/branch.one/content');
});

it('checks client-side extension and size limits without pretending to validate magic bytes', () => {
  expect(fileUploadError(new File(['x'], 'page.htm'))).toBeNull();
  expect(fileUploadError(new File(['x'], 'page.docx'))).toBe('invalidFile');
  expect(fileUploadError(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'page.html'))).toBe('tooLarge');
  expect(fileUploadError(new File(['x'], 'deck.pdf'), 'html')).toBe('invalidFile');
});
