import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { z } from 'zod';

export const GOOGLE_DOCUMENT_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DOCUMENT_MIME = 'application/vnd.google-apps.document';
export const DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
const fileIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{10,200}$/);
export const googleCredentialsSchema = z.object({
  accessToken: z.string().min(1).max(8192),
  refreshToken: z.string().min(1).max(8192),
  expiresAt: z.number().finite(),
});
export type GoogleCredentials = z.infer<typeof googleCredentialsSchema>;
const metadataSchema = z.object({
  id: fileIdSchema,
  name: z.string().min(1).max(1000),
  mimeType: z.literal(GOOGLE_DOCUMENT_MIME),
  version: z.string().regex(/^\d+$/),
  modifiedTime: z.string().datetime(),
  trashed: z.literal(false),
  capabilities: z.object({ canDownload: z.literal(true) }),
});
export type GoogleDocumentMetadata = z.infer<typeof metadataSchema>;
const tokenSchema = z.object({
  access_token: z.string().min(1).max(8192),
  refresh_token: z.string().min(1).max(8192).optional(),
  expires_in: z.number().positive().max(86400),
  scope: z.string().optional(),
});

export function googleDocumentId(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    const match = /^\/document\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/.exec(url.pathname);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'docs.google.com' ||
      url.port ||
      url.username ||
      url.password ||
      !match
    )
      throw new Error('invalid document URL');
    return fileIdSchema.parse(match[1]);
  } catch {
    throw new BadRequestException('Google Docs 문서 링크를 확인해 주세요.');
  }
}

@Injectable()
export class GoogleDocsProvider {
  configured(): boolean {
    try {
      this.config();
      return true;
    } catch {
      return false;
    }
  }

  private config() {
    const clientId = process.env.GOOGLE_DOCS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DOCS_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_DOCS_REDIRECT_URI;
    try {
      if (!clientId || !clientSecret || !redirectUri || !process.env.CONFIG_SECRET_KEY)
        throw new Error('missing config');
      const uri = new URL(redirectUri);
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname);
      if (
        (uri.protocol !== 'https:' &&
          !(process.env.NODE_ENV !== 'prod' && loopback && uri.protocol === 'http:')) ||
        uri.pathname !== '/documents/google/callback' ||
        uri.search ||
        uri.hash ||
        uri.username ||
        uri.password
      )
        throw new Error('invalid callback');
      return { clientId, clientSecret, redirectUri };
    } catch {
      throw new ServiceUnavailableException('관리자가 Google 문서 연결 설정을 완료해야 합니다.');
    }
  }

  authorizationUrl(input: { state: string; verifier: string; fileId: string }): string {
    const config = this.config();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: GOOGLE_DOCUMENT_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'false',
      trigger_onepick: 'true',
      allow_multiple: 'false',
      mimetypes: GOOGLE_DOCUMENT_MIME,
      file_ids: fileIdSchema.parse(input.fileId),
      state: input.state,
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(input.verifier).digest('base64url'),
    }).toString();
    return url.toString();
  }

  private async request(
    url: string,
    init: RequestInit,
    limit = 64 * 1024,
    preserveBom = false,
  ): Promise<string> {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      });
      if ([400, 401, 403, 404].includes(response.status)) {
        await response.body?.cancel();
        throw new ForbiddenException(
          'Google 문서 접근을 확인할 수 없습니다. 연결 권한과 원본 상태를 확인해 주세요.',
        );
      }
      if (!response.ok || Number(response.headers.get('content-length') || 0) > limit) {
        await response.body?.cancel();
        throw new BadGatewayException(
          'Google 문서를 가져오지 못했습니다. 크기 또는 연결 상태를 확인해 주세요.',
        );
      }
      const reader = response.body?.getReader();
      if (!reader) throw new BadGatewayException('Google 응답이 비어 있습니다.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new BadGatewayException('문서 사본은 최대 2 MiB까지 보관할 수 있습니다.');
        }
        chunks.push(value);
      }
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: preserveBom }).decode(
        Buffer.concat(chunks),
      );
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        'Google 연결에 실패했습니다. 기존 보관 버전은 변경하지 않았습니다.',
      );
    }
  }

  private async tokens(
    parameters: Record<string, string>,
    previous?: GoogleCredentials,
  ): Promise<GoogleCredentials> {
    const config = this.config();
    const raw = await this.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        ...parameters,
      }).toString(),
    });
    try {
      const result = tokenSchema.parse(JSON.parse(raw));
      if (result.scope && !result.scope.split(' ').includes(GOOGLE_DOCUMENT_SCOPE))
        throw new Error('missing scope');
      return googleCredentialsSchema.parse({
        accessToken: result.access_token,
        refreshToken: result.refresh_token ?? previous?.refreshToken,
        expiresAt: Date.now() + result.expires_in * 1000,
      });
    } catch {
      throw new BadGatewayException('Google 문서 연결 승인을 다시 진행해 주세요.');
    }
  }

  exchange(input: { code: string; verifier: string }): Promise<GoogleCredentials> {
    return this.tokens({
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.verifier,
      redirect_uri: this.config().redirectUri,
    });
  }

  async renew(credentials: GoogleCredentials): Promise<GoogleCredentials> {
    if (credentials.expiresAt > Date.now() + 60000) return credentials;
    return this.tokens(
      { grant_type: 'refresh_token', refresh_token: credentials.refreshToken },
      credentials,
    );
  }

  async metadata(fileId: string, credentials: GoogleCredentials): Promise<GoogleDocumentMetadata> {
    const fields = 'id,name,mimeType,version,modifiedTime,trashed,capabilities(canDownload)';
    const raw = await this.request(
      `https://www.googleapis.com/drive/v3/files/${fileIdSchema.parse(
        fileId,
      )}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      },
    );
    try {
      const data = metadataSchema.parse(JSON.parse(raw));
      if (data.id !== fileId) throw new Error('wrong file');
      return data;
    } catch {
      throw new ForbiddenException(
        '이 문서는 Google Docs 원문을 내려받을 권한이 없거나 사용할 수 없는 상태입니다.',
      );
    }
  }

  async snapshot(fileId: string, credentials: GoogleCredentials) {
    const before = await this.metadata(fileId, credentials);
    const markdown = await this.request(
      `https://www.googleapis.com/drive/v3/files/${fileIdSchema.parse(
        fileId,
      )}/export?mimeType=text%2Fmarkdown`,
      {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      },
      DOCUMENT_MAX_BYTES,
      true,
    );
    const after = await this.metadata(fileId, credentials);
    if (
      before.version !== after.version ||
      before.modifiedTime !== after.modifiedTime ||
      before.name !== after.name
    )
      throw new ConflictException(
        '가져오는 동안 원문이 바뀌었습니다. 다시 확인한 뒤 갱신해 주세요.',
      );
    return {
      metadata: after,
      markdown,
      sha256: createHash('sha256').update(markdown).digest('hex'),
      byteSize: Buffer.byteLength(markdown),
    };
  }
}
