import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { constants } from 'fs';
import { mkdir, open, rename, unlink } from 'fs/promises';
import { resolve } from 'path';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { metadataTransaction } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { ArtifactFile, ArtifactFileVersion } from './artifact.entity';
import {
  ArtifactUpload,
  artifactTitle,
  positiveInteger,
  validateArtifactUpload,
} from './artifact-upload';

export type ArtifactActor = { id: number; authVersion?: number };
@Injectable()
export class ArtifactsService {
  constructor(private readonly db: DataSource) {}

  private async actor(manager: EntityManager, actor: ArtifactActor) {
    if (!Number.isSafeInteger(actor?.id) || actor.id < 1) throw new UnauthorizedException();
    const user = await manager.findOne(User, {
      where: { id: actor.id },
      ...(this.db.options.type === 'sqlite'
        ? {}
        : { lock: { mode: 'pessimistic_write' as const } }),
    });
    if (!user || user.active === false || (actor.authVersion ?? 0) !== user.authVersion)
      throw new UnauthorizedException();
    return user;
  }

  private async owned(manager: EntityManager, id: string, actor: ArtifactActor) {
    await this.actor(manager, actor);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))
      throw new NotFoundException();
    const file = await manager.findOne(ArtifactFile, {
      where: { id, ownerId: actor.id, deletedAt: IsNull() },
      ...(this.db.options.type === 'sqlite'
        ? {}
        : { lock: { mode: 'pessimistic_write' as const } }),
    });
    if (!file) throw new NotFoundException();
    return file;
  }

  private shareActive(file: ArtifactFile) {
    return (
      !!file.shareHash &&
      !file.deletedAt &&
      (!file.shareExpiresAt || Date.parse(file.shareExpiresAt) > Date.now())
    );
  }

  private summary(file: ArtifactFile, version: ArtifactFileVersion) {
    return {
      id: file.id,
      kind: file.kind,
      title: file.title,
      headVersion: file.headVersion,
      revision: file.revision,
      size: version.byteSize,
      mimeType: version.mimeType,
      updatedAt: file.updatedAt,
      shareActive: this.shareActive(file),
      safePreview: file.kind !== 'pptx',
    };
  }

  private async detail(manager: EntityManager, file: ArtifactFile) {
    const versions = await manager.find(ArtifactFileVersion, {
      where: { artifactId: file.id },
      order: { version: 'DESC' },
    });
    const head = versions.find(version => version.version === file.headVersion);
    if (!head) throw new NotFoundException();
    return {
      ...this.summary(file, head),
      versions: versions.map(
        ({ version, originalName, mimeType, byteSize, sha256, createdAt }) => ({
          version,
          originalName,
          mimeType,
          byteSize,
          sha256,
          createdAt,
        }),
      ),
    };
  }

  list(actor: ArtifactActor) {
    return metadataTransaction(this.db, async manager => {
      await this.actor(manager, actor);
      const files = await manager.find(ArtifactFile, {
        where: { ownerId: actor.id, deletedAt: IsNull() },
        order: { updatedAt: 'DESC', id: 'ASC' },
      });
      const items = [];
      for (const file of files) {
        const head = await manager.findOneByOrFail(ArtifactFileVersion, {
          artifactId: file.id,
          version: file.headVersion,
        });
        items.push(this.summary(file, head));
      }
      return { items };
    });
  }

  get(id: string, actor: ArtifactActor) {
    return metadataTransaction(this.db, async manager =>
      this.detail(manager, await this.owned(manager, id, actor)),
    );
  }

  async upload(actor: ArtifactActor, raw: ArtifactUpload, title?: unknown) {
    const upload = validateArtifactUpload(raw);
    const name = artifactTitle(title, upload.originalName);
    return this.saveUpload(actor, upload, undefined, undefined, name);
  }

  async replace(id: string, actor: ArtifactActor, raw: ArtifactUpload, expectedVersion: unknown) {
    const upload = validateArtifactUpload(raw);
    return this.saveUpload(actor, upload, id, positiveInteger(expectedVersion));
  }

  private async saveUpload(
    actor: ArtifactActor,
    upload: ReturnType<typeof validateArtifactUpload>,
    id?: string,
    expectedVersion?: number,
    title?: string,
  ) {
    let written: string | undefined;
    let temporary: string | undefined;
    try {
      return await metadataTransaction(this.db, async manager => {
        let file: ArtifactFile;
        if (id) {
          file = await this.owned(manager, id, actor);
          if (file.headVersion !== expectedVersion)
            throw new ConflictException('Artifact version changed');
          if (file.kind !== upload.kind)
            throw new BadRequestException('Replacement must keep the artifact kind');
          file.headVersion++;
          file.revision++;
          file.updatedAt = new Date().toISOString();
        } else {
          await this.actor(manager, actor);
          const membership = await manager.findOneBy(EnterpriseMembership, { userId: actor.id });
          file = manager.create(ArtifactFile, {
            id: randomUUID(),
            ownerId: actor.id,
            organizationId: membership?.organizationId ?? null,
            kind: upload.kind,
            title,
            headVersion: 1,
            revision: 1,
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            shareHash: null,
            shareExpiresAt: null,
          });
        }
        const storageKey = `${file.id}/v${file.headVersion}.${upload.extension}`;
        const destination = this.storagePath(storageKey);
        await mkdir(resolve(destination, '..'), { recursive: true, mode: 0o700 });
        temporary = `${destination}.${randomUUID()}.tmp`;
        await (await open(temporary, 'wx', 0o600)).close();
        const handle = await open(temporary, 'r+');
        try {
          await handle.writeFile(upload.buffer);
        } finally {
          await handle.close();
        }
        await rename(temporary, destination);
        temporary = undefined;
        written = destination;
        await manager.save(ArtifactFile, file);
        await manager.insert(ArtifactFileVersion, {
          artifactId: file.id,
          version: file.headVersion,
          originalName: upload.originalName,
          mimeType: upload.mimeType,
          extension: upload.extension,
          byteSize: upload.byteSize,
          sha256: upload.sha256,
          storageKey,
          createdAt: file.updatedAt,
        });
        return this.detail(manager, file);
      });
    } catch (error) {
      if (temporary) await unlink(temporary);
      if (written) await unlink(written);
      throw error;
    }
  }

  private storagePath(key: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/v[1-9]\d*\.(html|htm|pdf|pptx)$/.test(
        key,
      )
    )
      throw new NotFoundException();
    return resolve(process.env.FILE_UPLOAD_DIR || 'uploads', 'artifacts', key);
  }

  private async bytes(manager: EntityManager, file: ArtifactFile, version: number) {
    const row = await manager.findOneBy(ArtifactFileVersion, { artifactId: file.id, version });
    if (!row) throw new NotFoundException();
    let handle: Awaited<ReturnType<typeof open>>;
    try {
      handle = await open(
        this.storagePath(row.storageKey),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
    } catch (error) {
      if (['ENOENT', 'ELOOP', 'ENOTDIR'].includes(error.code)) throw new NotFoundException();
      throw error;
    }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size !== row.byteSize) throw new NotFoundException();
      const buffer = await handle.readFile();
      if (createHash('sha256').update(buffer).digest('hex') !== row.sha256)
        throw new NotFoundException();
      return { buffer, mimeType: row.mimeType, originalName: row.originalName, kind: file.kind };
    } finally {
      await handle.close();
    }
  }

  content(id: string, version: unknown, actor: ArtifactActor) {
    const parsed = positiveInteger(version);
    return metadataTransaction(this.db, async manager =>
      this.bytes(manager, await this.owned(manager, id, actor), parsed),
    );
  }

  createShare(id: string, actor: ArtifactActor, body: unknown) {
    if (body === undefined) body = {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException();
    const expires = (body as { expiresAt?: unknown }).expiresAt;
    if (
      expires !== undefined &&
      (typeof expires !== 'string' ||
        !/^\d{4}-\d\d-\d\dT/.test(expires) ||
        !Number.isFinite(Date.parse(expires)) ||
        Date.parse(expires) <= Date.now())
    )
      throw new BadRequestException('Expiry must be a future ISO timestamp');
    return metadataTransaction(this.db, async manager => {
      const file = await this.owned(manager, id, actor);
      const token = randomBytes(32).toString('base64url');
      file.shareHash = createHash('sha256').update(token).digest('hex');
      file.shareExpiresAt = typeof expires === 'string' ? new Date(expires).toISOString() : null;
      file.revision++;
      file.updatedAt = new Date().toISOString();
      await manager.save(file);
      return { token, expiresAt: file.shareExpiresAt };
    });
  }

  revokeShare(id: string, actor: ArtifactActor) {
    return metadataTransaction(this.db, async manager => {
      const file = await this.owned(manager, id, actor);
      file.shareHash = null;
      file.shareExpiresAt = null;
      file.revision++;
      file.updatedAt = new Date().toISOString();
      await manager.save(file);
    });
  }

  private async shared(manager: EntityManager, token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new NotFoundException();
    const file = await manager.findOne(ArtifactFile, {
      where: { shareHash: createHash('sha256').update(token).digest('hex'), deletedAt: IsNull() },
      ...(this.db.options.type === 'sqlite' ? {} : { lock: { mode: 'pessimistic_read' as const } }),
    });
    if (!file || !this.shareActive(file)) throw new NotFoundException();
    return file;
  }

  sharedDetail(token: string) {
    return metadataTransaction(this.db, async manager => {
      const file = await this.shared(manager, token);
      const version = await manager.findOneByOrFail(ArtifactFileVersion, {
        artifactId: file.id,
        version: file.headVersion,
      });
      return this.summary(file, version);
    });
  }

  sharedContent(token: string) {
    return metadataTransaction(this.db, async manager => {
      const file = await this.shared(manager, token);
      const result = await this.bytes(manager, file, file.headVersion);
      await this.shared(manager, token);
      return result;
    });
  }

  remove(id: string, actor: ArtifactActor, expectedRevision: unknown) {
    const revision = positiveInteger(expectedRevision);
    return metadataTransaction(this.db, async manager => {
      const file = await this.owned(manager, id, actor);
      if (file.revision !== revision) throw new ConflictException('Artifact revision changed');
      file.deletedAt = new Date().toISOString();
      file.updatedAt = file.deletedAt;
      file.shareHash = null;
      file.shareExpiresAt = null;
      file.revision++;
      await manager.save(file);
    });
  }
}
