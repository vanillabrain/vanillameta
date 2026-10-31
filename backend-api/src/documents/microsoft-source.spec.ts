import { MicrosoftSourceService } from './microsoft-source.service';

describe('Microsoft document connection', () => {
  const provider = () => ({
    authorizationUrl: jest.fn(() => 'https://login.microsoftonline.com/?state=s'),
    exchange: jest.fn(async () => ({ accessToken: 'token' })),
    item: jest.fn(async () => ({ id: 'i', name: 'doc.txt', mimeType: 'text/plain', lastModifiedAt: null })),
    text: jest.fn(async () => '# 본문'),
  });
  it('rejects a malformed PKCE verifier', () => {
    expect(() => new MicrosoftSourceService(provider() as never).authorization('short')).toThrow();
  });
  it('exchanges, reads metadata and text without exposing the token', async () => {
    const fake = provider();
    const result = await new MicrosoftSourceService(fake as never).preview({
      code: 'c', verifier: 'v'.repeat(43), itemId: 'i',
    });
    expect(fake.exchange).toHaveBeenCalledWith('c', 'v'.repeat(43));
    expect(fake.item).toHaveBeenCalledWith('token', 'i');
    expect(fake.text).toHaveBeenCalledWith('token', 'i');
    expect(result).toEqual({ id: 'i', name: 'doc.txt', mimeType: 'text/plain', lastModifiedAt: null, markdown: '# 본문' });
    expect(JSON.stringify(result)).not.toContain('token');
  });
});

