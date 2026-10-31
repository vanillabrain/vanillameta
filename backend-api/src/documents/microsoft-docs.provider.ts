import { ServiceUnavailableException } from '@nestjs/common';

export const MICROSOFT_DOCUMENT_SCOPES = [
  'https://graph.microsoft.com/Files.Read.All',
  'offline_access',
];
export const MICROSOFT_TEXT_MIME = ['text/plain', 'text/markdown'];

export class MicrosoftDocsProvider {
  private config() {
    const clientId = process.env.MS_DOCS_CLIENT_ID;
    const clientSecret = process.env.MS_DOCS_CLIENT_SECRET;
    const redirectUri = process.env.MS_DOCS_REDIRECT_URI;
    try {
      const uri = new URL(redirectUri ?? '');
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname);
      if (!clientId || !clientSecret) throw new Error('missing');
      if (
        (uri.protocol !== 'https:' &&
          !(process.env.NODE_ENV !== 'prod' && loopback && uri.protocol === 'http:')) ||
        !uri.pathname.endsWith('/documents/microsoft/callback') ||
        uri.search ||
        uri.hash ||
        uri.username ||
        uri.password
      )
        throw new Error('callback');
      return { clientId, clientSecret, redirectUri: uri.toString() };
    } catch {
      throw new ServiceUnavailableException('관리자가 Microsoft 문서 연결 설정을 완료해야 합니다.');
    }
  }
  configured(): boolean {
    try {
      this.config();
      return true;
    } catch {
      return false;
    }
  }
  authorizationUrl(input: { state: string; verifier: string; itemId: string }) {
    const { clientId, redirectUri } = this.config();
    const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: MICROSOFT_DOCUMENT_SCOPES.join(' '),
      state: input.state,
      code_challenge: input.verifier,
      code_challenge_method: 'S256',
      prompt: 'consent',
    }).toString();
    return url.toString();
  }
  async exchange(code: string, verifier: string, fetcher: typeof fetch = fetch) {
    const { clientId, clientSecret, redirectUri } = this.config();
    const response = await fetcher('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
      }),
    });
    if (!response.ok)
      throw new ServiceUnavailableException('Microsoft 승인을 완료하지 못했습니다.');
    const body = (await response.json()) as { access_token?: string; refresh_token?: string };
    if (!body.access_token)
      throw new ServiceUnavailableException('Microsoft 토큰 응답을 확인할 수 없습니다.');
    return { accessToken: body.access_token, refreshToken: body.refresh_token ?? null };
  }
  async item(accessToken: string, itemId: string, fetcher: typeof fetch = fetch) {
    const response = await fetcher(
      'https://graph.microsoft.com/v1.0/me/drive/items/' +
        encodeURIComponent(itemId) +
        '?$select=id,name,file,lastModifiedDateTime',
      { headers: { authorization: 'Bearer ' + accessToken } },
    );
    if (!response.ok)
      throw new ServiceUnavailableException('Microsoft 문서 정보를 읽지 못했습니다.');
    const body = (await response.json()) as {
      id: string;
      name: string;
      file?: { mimeType?: string };
      lastModifiedDateTime?: string;
    };
    const mimeType = body.file?.mimeType ?? '';
    if (!MICROSOFT_TEXT_MIME.includes(mimeType))
      throw new ServiceUnavailableException(
        '텍스트 문서만 연결할 수 있습니다. Word 변환은 아직 지원하지 않습니다.',
      );
    return {
      id: body.id,
      name: body.name,
      mimeType,
      lastModifiedAt: body.lastModifiedDateTime ?? null,
    };
  }
  async text(accessToken: string, itemId: string, fetcher: typeof fetch = fetch) {
    const response = await fetcher(
      'https://graph.microsoft.com/v1.0/me/drive/items/' + encodeURIComponent(itemId) + '/content',
      { headers: { authorization: 'Bearer ' + accessToken } },
    );
    if (!response.ok)
      throw new ServiceUnavailableException('Microsoft 문서 본문을 읽지 못했습니다.');
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > 2 * 1024 * 1024)
      throw new ServiceUnavailableException('문서 본문이 2MiB를 넘습니다.');
    return text;
  }
}
