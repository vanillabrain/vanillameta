import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DataSource, EntityManager, Not } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { decryptConnectionConfig } from '../utils/crypto.util';
import { Database } from './entities/database.entity';
import { SourceDeleteReceipt } from './entities/source-delete-receipt.entity';
import { UploadLimits, uploadLimits } from './upload-limits';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StorageUsage {
  /** Active uploaded sources. */
  sources: number;
  /** Bytes on disk that belong to the user, whether or not the source row still exists. */
  bytes: number;
}

/**
 * What one user's uploaded files cost, and whether one more upload fits. The bytes are not stored
 * anywhere: they are read from the directories the user's data points at. That is three places, and
 * the file-versions of a live source alone would miss two of them:
 * - every directory a live uploaded source refers to (current file and kept versions);
 * - files of a deleted source whose cleanup has not finished (the row is gone, the files are not);
 * - refresh inputs staged for the user (`refresh-input/<id>`), which are not yet any version.
 * Commerce bundles that were imported but not connected have no owner on disk or in the database
 * and are not counted; the per-user request limit is what bounds them.
 */
@Injectable()
export class UserStorageService {
  private readonly logger = new Logger(UserStorageService.name);

  constructor(private readonly db: DataSource, private readonly duckdb: DuckDBService) {}

  private root() {
    return path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads');
  }

  /** The `<uuid>` directory of a managed file, only when it sits directly under the upload root. */
  private managedDirectory(filename: unknown): string | null {
    if (typeof filename !== 'string') return null;
    const directory = path.resolve(path.dirname(filename));
    return path.dirname(directory) === this.root() ? directory : null;
  }

  private async directories(manager: EntityManager, actor: number) {
    const found = new Set<string>();
    let sources = 0;
    const add = (filename: unknown) => {
      const directory = this.managedDirectory(filename);
      if (directory) found.add(directory);
    };

    const owned = await manager.find(Database, { where: { ownerId: actor, engine: 'duckdb' } });
    for (const row of owned) {
      if (row.catalogActive !== false) sources += 1;
      try {
        const config = JSON.parse(decryptConnectionConfig(row.connectionConfig));
        add(config?.connection?.filename);
        for (const version of config?.fileVersions ?? []) add(version?.filename);
      } catch {
        this.logger.warn(`upload accounting could not read source ${row.id}`);
      }
    }

    const receipts = await manager.find(SourceDeleteReceipt, {
      where: { actorId: actor, cleanupStatus: Not('complete') },
    });
    for (const receipt of receipts) {
      try {
        const plan = JSON.parse(decryptConnectionConfig(receipt.filePlan));
        for (const file of plan?.files ?? []) if (!file?.done) add(file?.filename);
      } catch {
        this.logger.warn(`upload accounting could not read deletion receipt ${receipt.id}`);
      }
    }

    const staged = path.join(this.root(), 'refresh-input');
    let names: string[] = [];
    try {
      names = await fs.readdir(staged);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    for (const name of names.filter(candidate => UUID.test(candidate))) {
      try {
        const admission = JSON.parse(
          await fs.readFile(path.join(staged, name, 'admission.json'), 'utf8'),
        );
        if (admission?.actorId === actor) found.add(path.join(staged, name));
      } catch {
        // A directory without a readable admission is somebody else's or an orphan being cleaned up.
      }
    }
    return { directories: found, sources };
  }

  async usage(manager: EntityManager, actor: number): Promise<StorageUsage> {
    const { directories, sources } = await this.directories(manager, actor);
    let bytes = 0;
    for (const directory of directories) bytes += await this.duckdb.directoryBytes(directory);
    return { sources, bytes };
  }

  /**
   * Refuses the upload with 403 `UPLOAD_QUOTA_EXCEEDED` when it would not fit. 403 rather than 429:
   * stored bytes do not free up with time, so a Retry-After would be false.
   */
  async assertWithin(
    manager: EntityManager,
    actor: number,
    incoming: { bytes: number; newSource?: boolean },
    limits: UploadLimits = uploadLimits(),
  ): Promise<StorageUsage> {
    const used = await this.usage(manager, actor);
    if (incoming.newSource && used.sources >= limits.maxSources)
      throw this.denied('sources', limits.maxSources, used.sources);
    if (used.bytes + incoming.bytes > limits.maxBytes)
      throw this.denied('bytes', limits.maxBytes, used.bytes);
    return used;
  }

  private denied(reason: 'sources' | 'bytes', limit: number, used: number) {
    return new ForbiddenException({
      error: 'UPLOAD_QUOTA_EXCEEDED',
      message:
        reason === 'sources'
          ? '업로드한 데이터 소스 수 한도에 도달했습니다. 사용하지 않는 소스를 삭제한 뒤 다시 시도해 주세요.'
          : '저장 용량 한도에 도달했습니다. 사용하지 않는 소스를 삭제하거나 파일 크기를 줄여 다시 시도해 주세요.',
      reason,
      limit,
      used,
    });
  }
}
