import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Readable } from 'stream';
import { of } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ARTIFACT_MULTIPART_OPTIONS, ArtifactMultipartInterceptor } from './artifact-multipart';
import { ArtifactsController, ArtifactSharedController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';

const actor = { id: 3, authVersion: 4 };
const req = { user: { accessKeyData: actor } };
const content = {
  buffer: Buffer.from('<html><script>alert(1)</script></html>'),
  mimeType: 'text/html',
  originalName: '분석.html',
  kind: 'html' as const,
};
const file = {
  originalname: '분석.html',
  mimetype: 'text/html',
  buffer: Buffer.from('<html>Hello</html>'),
};

describe('artifact HTTP controller boundary', () => {
  const artifacts = {
    list: jest.fn(async () => ({ items: [] })),
    upload: jest.fn(async () => ({ id: 'new' })),
    get: jest.fn(async () => ({ id: 'file' })),
    replace: jest.fn(async () => ({ id: 'file', headVersion: 2 })),
    content: jest.fn(async () => content),
    createShare: jest.fn(async () => ({ token: 'once', expiresAt: null })),
    revokeShare: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    sharedDetail: jest.fn(async () => ({ id: 'file', headVersion: 2 })),
    sharedContent: jest.fn(async () => content),
  };
  const controller = new ArtifactsController(artifacts as unknown as ArtifactsService);
  const shared = new ArtifactSharedController(artifacts as unknown as ArtifactsService);
  const response = () => {
    const result: any = { headers: {}, body: undefined };
    result.set = (headers: object) => Object.assign(result.headers, headers);
    result.send = (body: Buffer) => {
      result.body = body;
    };
    return result;
  };

  it('authenticates owner routes, leaves token routes public, and caps one uploaded file', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ArtifactsController)).toBe('artifacts/files');
    expect(Reflect.getMetadata(PATH_METADATA, ArtifactSharedController)).toBe('artifacts/shared');
    expect(Reflect.getMetadata(GUARDS_METADATA, ArtifactsController)).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, ArtifactSharedController)).toBeUndefined();
    expect(ARTIFACT_MULTIPART_OPTIONS.limits).toEqual({
      fileSize: 20 * 1024 * 1024,
      files: 1,
      fields: 2,
      parts: 3,
      fieldSize: 1024,
    });
    expect(typeof ArtifactMultipartInterceptor).toBe('function');
  });

  it('parses one UTF-8 multipart file into memory without a network listener', async () => {
    const boundary = 'artifact-boundary';
    const uploaded = Buffer.from('<html>Hello</html>');
    const body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nAnalysis\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="분석.html"\r\nContent-Type: text/html\r\n\r\n<html>Hello</html>\r\n` +
        `--${boundary}--\r\n`,
    );
    const request: any = Readable.from(body);
    request.headers = {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(body.length),
    };
    const downstream = of('downstream');
    const next = { handle: jest.fn(() => downstream) };
    const context: any = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
    };
    const result = await new ArtifactMultipartInterceptor().intercept(context, next);
    expect(result).toBe(downstream);
    expect(request.file).toMatchObject({
      originalname: '분석.html',
      mimetype: 'text/html',
      buffer: uploaded,
    });
    expect(request.file.buffer.toString()).toBe('<html>Hello</html>');
    expect(request.body.title).toBe('Analysis');
  });

  it('passes current actor, UTF-8 file, title, and expected version into the service', async () => {
    await expect(controller.list(req)).resolves.toEqual({ items: [] });
    await controller.upload(req, file, 'Analysis');
    await controller.detail('file', req);
    await controller.replace('file', req, file, '1');
    await controller.content('file', '1', req, response());
    await controller.share('file', req, { expiresAt: '2030-01-01T00:00:00Z' });
    await controller.revoke('file', req);
    await controller.remove('file', req, 3);
    await shared.detail('token');
    await shared.content('token', response());
    expect(artifacts.upload).toHaveBeenCalledWith(actor, file, 'Analysis');
    expect(artifacts.replace).toHaveBeenCalledWith('file', actor, file, '1');
    expect(artifacts.content).toHaveBeenCalledWith('file', '1', actor);
    expect(artifacts.createShare).toHaveBeenCalledWith('file', actor, {
      expiresAt: '2030-01-01T00:00:00Z',
    });
    expect(artifacts.remove).toHaveBeenCalledWith('file', actor, 3);
    expect(artifacts.sharedContent).toHaveBeenCalledWith('token');
  });

  it('serves inline original bytes with a script-blocking sandbox and no shared caches', async () => {
    const res = response();
    await controller.content('file', '1', req, res);
    expect(res.body).toBe(content.buffer);
    expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(res.headers['Content-Length']).toBe(String(content.buffer.length));
    expect(res.headers['Content-Security-Policy']).toContain("sandbox; default-src 'none'");
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['Referrer-Policy']).toBe('no-referrer');
    expect(res.headers['Content-Disposition']).toContain('inline');
    expect(res.headers['Content-Disposition']).toContain(
      "filename*=UTF-8''%EB%B6%84%EC%84%9D.html",
    );
  });
});
