import multer from 'multer';
import { Readable } from 'stream';
import { UTF8_MULTIPART_OPTIONS } from './multipart-options';
import { Utf8FileInterceptor as FileInterceptor } from './multipart-options';
async function parseFilename(header: string) {
  const boundary = 'vm-utf8-filename';
  const body = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; ${header}\r\nContent-Type: text/csv\r\n\r\nn\n1\n\r\n--${boundary}--\r\n`,
    'utf8',
  );
  const req: any = Readable.from([body]);
  req.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length),
  };
  await new Promise<void>((resolve, reject) =>
    multer({ ...UTF8_MULTIPART_OPTIONS }).single('file')(req, {} as any, error =>
      error ? reject(error) : resolve(),
    ),
  );
  return req.file.originalname;
}
describe('browser multipart filename decoding', () => {
  async function uploadWith(options: multer.Options, headers?: any) {
    const boundary = 'vm-upload-limits';
    const body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="plain.csv"\r\n\r\nn\n1\n\r\n--${boundary}--\r\n`,
    );
    const req: any = Readable.from([body]);
    req.headers = {
      ...(headers ?? {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(body.length),
      }),
      'content-length': String(body.length),
    };
    const Type = FileInterceptor('file', options),
      interceptor = new Type();
    await interceptor.intercept(
      { switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }) } as any,
      { handle: () => undefined },
    );
    return req;
  }
  it('preserves file-size and file-count rejection status', async () => {
    await expect(uploadWith({ limits: { fileSize: 1 } })).rejects.toMatchObject({ status: 413 });
    await expect(uploadWith({ limits: { files: 0 } })).rejects.toMatchObject({ status: 400 });
  });
  it('rejects malformed multipart headers without masking storage failures', async () => {
    await expect(uploadWith({}, { 'content-type': 'multipart/form-data' })).rejects.toMatchObject({
      status: 400,
    });
    const error = new Error('disk failure');
    await expect(
      uploadWith({
        storage: {
          _handleFile: (_req, _file, cb) => cb(error),
          _removeFile: (_req, _file, cb) => cb(null),
        },
      }),
    ).rejects.toBe(error);
  });
  it('the actual Nest upload interceptor preserves browser UTF-8 filenames', async () => {
    const name = 'SPR 공개 마진 18행.csv',
      boundary = 'vm-nest-utf8';
    const body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/csv\r\n\r\nn\n1\n\r\n--${boundary}--\r\n`,
    );
    const req: any = Readable.from([body]);
    req.headers = {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(body.length),
    };
    const Type = FileInterceptor('file', {
      storage: multer.memoryStorage(),
      ...UTF8_MULTIPART_OPTIONS,
    });
    const interceptor: any = new Type();
    await interceptor.intercept(
      { switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }) },
      { handle: () => undefined },
    );
    expect(req.file.originalname).toBe(name);
  });
  it.each(['SPR 공개 마진 18행.csv', 'plain.csv', 'café.csv', 'Ã©.csv'])(
    'keeps %s exactly once',
    async name => {
      expect(await parseFilename(`filename="${name}"`)).toBe(name);
    },
  );
  it('honours explicit UTF-8 filename parameters without double decoding', async () => {
    expect(await parseFilename("filename*=UTF-8''%C3%83%C2%A9.csv")).toBe('Ã©.csv');
  });
});
