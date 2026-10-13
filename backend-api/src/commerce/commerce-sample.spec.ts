import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CommerceService } from './commerce.service';
jest.mock('../ai/ai.service', () => ({ AiService: class {} }));

describe('owned bundled commerce sample', () => {
  let root: string;
  let oldDir: string | undefined;
  let sources: any;
  let service: CommerceService;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-sample-'));
    oldDir = process.env.FILE_UPLOAD_DIR;
    process.env.FILE_UPLOAD_DIR = root;
    sources = { findOne: jest.fn().mockResolvedValue(null) };
    service = new CommerceService(sources, {} as any, {} as any, {} as any);
  });
  afterEach(() => {
    if (oldDir === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = oldDir;
    fs.rmSync(root, { recursive: true, force: true });
  });
  it('copies bundled files into disposable uploads and keeps originals intact', async () => {
    const create = jest
      .spyOn(service, 'createAndImport')
      .mockImplementation(async (owner, _name, files) => {
        expect(owner).toBe(7);
        for (const key of ['orders', 'payments', 'refunds', 'customers']) {
          expect(files[key][0].path.startsWith(root)).toBe(true);
          expect(fs.readFileSync(files[key][0].path, 'utf8')).toBe(
            fs.readFileSync(path.join(__dirname, 'samples', key + '.csv'), 'utf8'),
          );
        }
        return { status: 'SUCCESS', data: { projectId: 42 } } as any;
      });
    expect((await service.openSample(7)).data.projectId).toBe(42);
    expect(create).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(path.join(root, 'commerce-incoming'))).toEqual([]);
    expect(fs.existsSync(path.join(__dirname, 'samples', 'orders.csv'))).toBe(true);
  });
  it('reuses only ready data with the same owner and content digest', async () => {
    sources.findOne.mockResolvedValue({ id: 19 });
    const create = jest.spyOn(service, 'createAndImport');
    expect((await service.openSample(8)).data).toEqual({ projectId: 19, reused: true });
    expect(sources.findOne.mock.calls[0][0].where).toEqual({
      ownerId: 8,
      status: 'ready',
      publishedDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(create).not.toHaveBeenCalled();
  });
  it('coalesces same-owner concurrent requests and allows retry after failure', async () => {
    jest
      .spyOn(service, 'createAndImport')
      .mockRejectedValueOnce(new Error('temporary import failure'));
    const first = service.openSample(7);
    expect(service.openSample(7)).toBe(first);
    await expect(first).rejects.toThrow('샘플을 준비하지 못했습니다.');
    expect(fs.readdirSync(path.join(root, 'commerce-incoming'))).toEqual([]);
    sources.findOne.mockResolvedValue({ id: 20 });
    expect((await service.openSample(7)).data.projectId).toBe(20);
  });
});
