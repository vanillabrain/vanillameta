import {
  GoogleDocsProvider,
  googleDocumentId,
  GOOGLE_DOCUMENT_SCOPE,
  DOCUMENT_MAX_BYTES,
} from './google-docs.provider';

describe('Google document provider boundary', () => {
  const fileId = 'document_1234567890';
  const credentials = {
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
    expiresAt: Date.now() + 3600000,
  };
  const metadata = {
    id: fileId,
    name: '매출 보고서',
    mimeType: 'application/vnd.google-apps.document',
    version: '9007199254740995',
    modifiedTime: '2026-10-29T00:00:00.000Z',
    trashed: false,
    capabilities: { canDownload: true },
  };
  const provider = new GoogleDocsProvider();
  let fetchMock: jest.SpyInstance;
  const original = { ...process.env };
  beforeEach(() => {
    process.env.GOOGLE_DOCS_CLIENT_ID = 'test.apps.googleusercontent.com';
    process.env.GOOGLE_DOCS_CLIENT_SECRET = 'test-secret';
    process.env.GOOGLE_DOCS_REDIRECT_URI = 'http://127.0.0.1:3000/documents/google/callback';
    process.env.CONFIG_SECRET_KEY = 'test-key';
    process.env.NODE_ENV = 'local';
    fetchMock = jest.spyOn(global, 'fetch');
  });
  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });
  const json = (body: unknown) => new Response(JSON.stringify(body));

  it('selects one pinned document without asking for whole-drive access', () => {
    const url = new URL(
      provider.authorizationUrl({ state: 'nonce', verifier: 'secret-verifier', fileId }),
    );
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('scope')).toBe(GOOGLE_DOCUMENT_SCOPE);
    expect(url.searchParams.get('trigger_onepick')).toBe('true');
    expect(url.searchParams.get('file_ids')).toBe(fileId);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.toString()).not.toContain('test-secret');
    expect(url.toString()).not.toContain('secret-verifier');
  });

  it.each([
    'http://docs.google.com/document/d/document_1234567890',
    'https://docs.google.com.evil.test/document/d/document_1234567890',
    'https://user@docs.google.com/document/d/document_1234567890',
    'https://docs.google.com:444/document/d/document_1234567890',
    'https://drive.google.com/file/d/document_1234567890',
  ])('rejects untrusted URL %s before network', value => {
    expect(() => googleDocumentId(value)).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('parses a Docs link without fetching its query or fragment', () => {
    expect(
      googleDocumentId(`https://docs.google.com/document/d/${fileId}/edit?tab=t.1#heading`),
    ).toBe(fileId);
  });
  it('reports missing setup and rejects insecure production callbacks', () => {
    delete process.env.GOOGLE_DOCS_CLIENT_SECRET;
    expect(provider.configured()).toBe(false);
    process.env.GOOGLE_DOCS_CLIENT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'prod';
    expect(provider.configured()).toBe(false);
    process.env.GOOGLE_DOCS_REDIRECT_URI = 'https://vm.example/documents/google/callback';
    expect(provider.configured()).toBe(true);
    process.env.GOOGLE_DOCS_REDIRECT_URI += '?return=https://evil.test';
    expect(provider.configured()).toBe(false);
  });
  it('exchanges code with fixed token endpoint and PKCE without exposing provider errors', async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        access_token: 'a',
        refresh_token: 'r',
        expires_in: 3600,
        scope: GOOGLE_DOCUMENT_SCOPE,
      }),
    );
    expect(
      await provider.exchange({ code: 'code-value', verifier: 'verifier-value' }),
    ).toMatchObject({ accessToken: 'a', refreshToken: 'r' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(new URLSearchParams(init.body).get('code_verifier')).toBe('verifier-value');
    expect(init.redirect).toBe('error');
    fetchMock.mockResolvedValueOnce(new Response('secret provider details', { status: 400 }));
    await expect(provider.exchange({ code: 'c', verifier: 'v' })).rejects.not.toThrow(
      'secret provider details',
    );
  });
  it('requires a new refresh token for a new consent, never borrowing another account token', async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: 'a', expires_in: 3600 }));
    await expect(provider.exchange({ code: 'c', verifier: 'v' })).rejects.toThrow();
  });
  it('retains same-generation refresh token when renewal omits it', async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: 'new-access', expires_in: 3600 }));
    expect(await provider.renew({ ...credentials, expiresAt: 0 })).toMatchObject({
      accessToken: 'new-access',
      refreshToken: 'test-refresh',
    });
    const before = fetchMock.mock.calls.length;
    expect(await provider.renew(credentials)).toEqual(credentials);
    expect(fetchMock.mock.calls).toHaveLength(before);
  });
  it('preserves exact Markdown bytes and large opaque version strings', async () => {
    const markdown = '# 매출 보고서\n\n순매출 **16,537.01**\n';
    fetchMock
      .mockResolvedValueOnce(json(metadata))
      .mockResolvedValueOnce(new Response(markdown))
      .mockResolvedValueOnce(json(metadata));
    const result = await provider.snapshot(fileId, credentials);
    expect(result.markdown).toBe(markdown);
    expect(result.byteSize).toBe(Buffer.byteLength(markdown));
    expect(result.metadata.version).toBe('9007199254740995');
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      fetchMock.mock.calls.every(
        ([url, init]) => url.startsWith('https://www.googleapis.com/') && init.redirect === 'error',
      ),
    ).toBe(true);
  });
  it('rejects source drift while exporting', async () => {
    fetchMock
      .mockResolvedValueOnce(json(metadata))
      .mockResolvedValueOnce(new Response('first'))
      .mockResolvedValueOnce(json({ ...metadata, version: '9007199254740996' }));
    await expect(provider.snapshot(fileId, credentials)).rejects.toThrow(
      '가져오는 동안 원문이 바뀌었습니다',
    );
  });
  it('preserves an accepted UTF-8 BOM as part of the stored bytes', async () => {
    const markdown = '\uFEFF# Saved text\n';
    fetchMock
      .mockResolvedValueOnce(json(metadata))
      .mockResolvedValueOnce(new Response(markdown))
      .mockResolvedValueOnce(json(metadata));
    const result = await provider.snapshot(fileId, credentials);
    expect(result.markdown).toBe(markdown);
    expect(result.byteSize).toBe(Buffer.byteLength(markdown));
  });
  it.each([
    { ...metadata, trashed: true },
    { ...metadata, capabilities: { canDownload: false } },
    { ...metadata, mimeType: 'application/pdf' },
    { ...metadata, id: 'another_document_id' },
  ])('rejects invalid source metadata', async value => {
    fetchMock.mockResolvedValueOnce(json(value));
    await expect(provider.snapshot(fileId, credentials)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('counts streamed bytes rather than trusting content-length and never truncates', async () => {
    fetchMock
      .mockResolvedValueOnce(json(metadata))
      .mockResolvedValueOnce(
        new Response('x'.repeat(DOCUMENT_MAX_BYTES + 1), { headers: { 'content-length': '1' } }),
      );
    await expect(provider.snapshot(fileId, credentials)).rejects.toThrow('최대 2 MiB');
  });
  it('does not expose raw network failures containing sensitive URLs', async () => {
    fetchMock.mockRejectedValueOnce(new Error('https://google.example?token=sensitive'));
    await expect(provider.metadata(fileId, credentials)).rejects.not.toThrow('sensitive');
  });
});
