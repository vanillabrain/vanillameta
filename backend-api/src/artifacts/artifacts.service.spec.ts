import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { AddFileArtifacts1793440000000 } from '../migrations/1793440000000-add-file-artifacts';
import { ARTIFACT_ENTITIES, ArtifactFile, ArtifactFileVersion } from './artifact.entity';
import { ArtifactUpload, validateArtifactUpload } from './artifact-upload';
import { ArtifactsService } from './artifacts.service';

const owner = { id: 1, authVersion: 0 };
const other = { id: 2, authVersion: 0 };
const html = (text = '<html><body>Hello</body></html>'): ArtifactUpload => ({
  originalname: '분석.html',
  mimetype: 'text/html',
  buffer: Buffer.from(text),
});
const pdf: ArtifactUpload = {
  originalname: 'report.pdf',
  mimetype: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7\nfixture'),
};
const pptx: ArtifactUpload = {
  originalname: 'deck.pptx',
  mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  buffer: Buffer.from([0x50, 0x4b, 3, 4, 1]),
};

describe('file artifacts with real metadata transactions and isolated files', () => {
  let db: DataSource, service: ArtifactsService, root: string;
  const previousRoot = process.env.FILE_UPLOAD_DIR;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'artifact-test-'));
    process.env.FILE_UPLOAD_DIR = root;
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, EnterpriseMembership, ...ARTIFACT_ENTITIES],
      synchronize: true,
    }).initialize();
    await db.manager.insert(User, [
      { id: 1, userId: 'owner', email: 'owner@example.invalid', password: 'fixture' },
      { id: 2, userId: 'other', email: 'other@example.invalid', password: 'fixture' },
    ]);
    await db.manager.insert(EnterpriseMembership, { userId: 1, organizationId: 4, role: 'member' });
    service = new ArtifactsService(db);
  });
  afterAll(async () => {
    await db?.destroy();
    await rm(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.FILE_UPLOAD_DIR;
    else process.env.FILE_UPLOAD_DIR = previousRoot;
  });

  it.each([html(), pdf, pptx])(
    'uploads validated $originalname and exposes only public metadata',
    async upload => {
      const detail = await service.upload(owner, upload);
      expect(detail).toMatchObject({
        title: upload.originalname.replace(/\.[^.]+$/, ''),
        headVersion: 1,
        revision: 1,
        size: upload.buffer.length,
        safePreview: upload !== pptx,
      });
      expect(detail.versions).toEqual([
        {
          version: 1,
          originalName: upload.originalname,
          mimeType: upload.mimetype,
          byteSize: upload.buffer.length,
          sha256: createHash('sha256').update(upload.buffer).digest('hex'),
          createdAt: detail.updatedAt,
        },
      ]);
      expect(await service.get(detail.id, owner)).toEqual(detail);
      expect((await service.list(owner)).items).toContainEqual(
        expect.objectContaining({ id: detail.id }),
      );
      expect((await service.list(other)).items).toEqual([]);
      expect((await service.content(detail.id, 1, owner)).buffer).toEqual(upload.buffer);
      expect(await readFile(join(root, 'artifacts', detail.id, `v1.${detail.kind}`))).toEqual(
        upload.buffer,
      );
      expect(await db.manager.findOneBy(ArtifactFile, { id: detail.id })).toMatchObject({
        ownerId: 1,
        organizationId: 4,
      });
      await expect(service.get(detail.id, other)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.content(detail.id, 1, other)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.replace(detail.id, other, upload, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.createShare(detail.id, other, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.revokeShare(detail.id, other)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.remove(detail.id, other, 1)).rejects.toBeInstanceOf(NotFoundException);
    },
  );

  it('preserves old bytes and rejects concurrent stale replacements without leaving files', async () => {
    const detail = await service.upload(owner, html());
    const results = await Promise.allSettled([
      service.replace(detail.id, owner, html('<html>Second</html>'), '1'),
      service.replace(detail.id, owner, html('<html>Third</html>'), '1'),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    expect((await service.get(detail.id, owner)).versions.map(row => row.version)).toEqual([2, 1]);
    expect((await service.content(detail.id, 1, owner)).buffer).toEqual(html().buffer);
    expect(await readdir(join(root, 'artifacts', detail.id))).toEqual(['v1.html', 'v2.html']);
    await expect(service.replace(detail.id, owner, pdf, 2)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('stores only token hashes, rotates links, follows the head, and revokes', async () => {
    const file = await service.upload(owner, html());
    const first = await service.createShare(file.id, owner, {});
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await db.manager.findOneBy(ArtifactFile, { id: file.id });
    expect(row.shareHash).toBe(createHash('sha256').update(first.token).digest('hex'));
    expect(JSON.stringify(await service.get(file.id, owner))).not.toContain(first.token);
    expect(await service.sharedDetail(first.token)).toMatchObject({
      id: file.id,
      headVersion: 1,
      shareActive: true,
    });
    await service.replace(file.id, owner, html('<html>Updated</html>'), 1);
    expect((await service.sharedContent(first.token)).buffer.toString()).toBe(
      '<html>Updated</html>',
    );
    const next = await service.createShare(file.id, owner, {
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    await expect(service.sharedContent(first.token)).rejects.toBeInstanceOf(NotFoundException);
    await service.revokeShare(file.id, owner);
    await expect(service.sharedDetail(next.token)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.sharedContent(next.token)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for expired, malformed, unknown, and deleted shares while preserving versions', async () => {
    const file = await service.upload(owner, pdf);
    const share = await service.createShare(file.id, owner, {});
    await db.manager.update(ArtifactFile, file.id, { shareExpiresAt: '2000-01-01T00:00:00.000Z' });
    await expect(service.sharedDetail(share.token)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.sharedContent(share.token)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.sharedContent('../bad')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.sharedContent('A'.repeat(43))).rejects.toBeInstanceOf(NotFoundException);
    const next = await service.createShare(file.id, owner, {});
    await expect(service.remove(file.id, owner, 1)).rejects.toBeInstanceOf(ConflictException);
    const detail = await service.get(file.id, owner);
    await service.remove(file.id, owner, detail.revision);
    await expect(service.get(file.id, owner)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.content(file.id, 1, owner)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.sharedContent(next.token)).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.list(owner)).items.some(item => item.id === file.id)).toBe(false);
    expect(await db.manager.countBy(ArtifactFileVersion, { artifactId: file.id })).toBe(1);
    expect(await readFile(join(root, 'artifacts', file.id, 'v1.pdf'))).toEqual(pdf.buffer);
  });

  it('rejects inactive and stale sessions, invalid expiry, titles, and version inputs', async () => {
    const file = await service.upload(owner, html());
    await expect(service.upload({ ...owner, authVersion: 1 }, html())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await db.manager.update(User, 2, { active: false });
    await expect(service.list(other)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.replace(file.id, owner, html(), '1x')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.upload(owner, html(), ' '.repeat(2))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(() =>
      service.createShare(file.id, owner, { expiresAt: '2000-01-01T00:00:00Z' }),
    ).toThrow(BadRequestException);
    expect(() => service.createShare(file.id, owner, { expiresAt: 9000 })).toThrow(
      BadRequestException,
    );
  });

  it('removes temporary and final bytes on database failure and rolls back metadata', async () => {
    const file = await service.upload(owner, html());
    await db.query(
      "CREATE TRIGGER reject_artifact_version BEFORE INSERT ON artifact_file_version WHEN NEW.version = 2 BEGIN SELECT RAISE(ABORT, 'fixture'); END",
    );
    try {
      await expect(
        service.replace(file.id, owner, html('<html>Failed</html>'), 1),
      ).rejects.toThrow();
      expect((await service.get(file.id, owner)).headVersion).toBe(1);
      expect(await readdir(join(root, 'artifacts', file.id))).toEqual(['v1.html']);
    } finally {
      await db.query('DROP TRIGGER reject_artifact_version');
    }
  });

  it('fails closed on missing and tampered bytes', async () => {
    const file = await service.upload(owner, pdf);
    await writeFile(join(root, 'artifacts', file.id, 'v1.pdf'), Buffer.alloc(pdf.buffer.length));
    await expect(service.content(file.id, 1, owner)).rejects.toBeInstanceOf(NotFoundException);
    await rm(join(root, 'artifacts', file.id, 'v1.pdf'));
    await expect(service.content(file.id, 1, owner)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('upload validation', () => {
  it.each([
    { ...pdf, buffer: Buffer.from('bad') },
    { ...pdf, originalname: 'wrong.html' },
    { ...pptx, buffer: Buffer.from('bad') },
    { ...html(), mimetype: 'application/octet-stream' },
    { ...html(), buffer: Buffer.from([0xff, 0xfe, 0]) },
    html('%PDF-1.7'),
    html('plain text'),
    { ...pdf, originalname: '../report.pdf' },
  ])('rejects mismatched or unsafe $originalname', file => {
    expect(() => validateArtifactUpload(file)).toThrow(BadRequestException);
  });
  it.each([html(), pdf, pptx])('enforces the size limit for $originalname', file => {
    const limit = file.mimetype === 'text/html' ? 5 : 20;
    expect(() =>
      validateArtifactUpload({ ...file, buffer: Buffer.alloc(limit * 1024 * 1024 + 1) }),
    ).toThrow(PayloadTooLargeException);
  });
});

describe('artifact migration', () => {
  it('creates both tables with a restrictive version FK and reverts in child order', async () => {
    const db = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
    const runner = db.createQueryRunner();
    const migration = new AddFileArtifacts1793440000000();
    try {
      await migration.up(runner);
      await migration.up(runner);
      expect((await runner.getTable('artifact_file_version')).foreignKeys[0].onDelete).toBe(
        'RESTRICT',
      );
      await expect(
        runner.query(
          "INSERT INTO artifact_file_version VALUES ('missing', 1, 'x', 'text/html', 'html', 1, 'hash', 'key', 'date')",
        ),
      ).rejects.toThrow();
      await migration.down(runner);
      expect(await runner.hasTable('artifact_file')).toBe(false);
      expect(await runner.hasTable('artifact_file_version')).toBe(false);
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
