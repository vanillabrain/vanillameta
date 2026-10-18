import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DuckDBService } from '../analysis/duckdb.service';
import { Database } from '../database/entities/database.entity';
import { decryptConnectionConfig, encryptConnectionConfig } from '../utils/crypto.util';
import { CommerceSource } from './entities/commerce-source.entity';
import { metadataTransaction } from '../common/metadata-work';

class CommerceStudioInputError extends BadRequestException {}

/** Private version-pinned order cohort. Never writes to the Commerce file or auto-runs AI. */
@Injectable()
export class CommerceStudioService {
  private pending = new Map<string, Promise<any>>();
  constructor(private readonly db: DataSource, private readonly duckdb: DuckDBService) {}

  private async source(actor: number, id: number, manager = this.db.manager, lock = false) {
    if (!Number.isSafeInteger(actor) || actor <= 0 || !Number.isSafeInteger(id) || id <= 0)
      throw new BadRequestException('프로젝트를 확인해 주세요.');
    const source = await manager.findOne(CommerceSource, {
      where: { id },
      ...(lock && this.db.options.type === 'mysql'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!source) throw new NotFoundException('프로젝트를 찾을 수 없습니다.');
    if (source.ownerId !== actor) throw new ForbiddenException('프로젝트 접근 권한이 없습니다.');
    if (
      source.status !== 'ready' ||
      !source.publishedFilename ||
      !source.publishedDigest ||
      source.currentVersion < 1
    )
      throw new BadRequestException('먼저 정상 데이터를 가져와 주세요.');
    return source;
  }
  async connect(actor: number, id: number) {
    const source = await this.source(actor, id);
    const key = `${actor}:${id}:${source.currentVersion}:${source.publishedDigest}`;
    const pending = this.pending.get(key);
    if (pending) return pending;
    if (this.pending.size >= 16)
      throw new ServiceUnavailableException(
        '데이터 준비 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
      );
    const promise = this.prepare(actor, source)
      .catch(error => {
        if (
          error instanceof CommerceStudioInputError ||
          error instanceof ConflictException ||
          error instanceof ForbiddenException ||
          error instanceof NotFoundException
        )
          throw error;
        throw new ServiceUnavailableException(
          'Studio 데이터를 준비하지 못했습니다. 원본 파일과 저장 상태를 확인한 뒤 다시 시도해 주세요.',
        );
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
  private tag(source: CommerceSource) {
    return `commerce-studio:order-cohort-v1:${source.id}:${source.currentVersion}:${source.publishedDigest}`;
  }
  private async existing(actor: number, source: CommerceSource, manager: EntityManager) {
    const rows = await manager.find(Database, {
      where: { ownerId: actor, description: this.tag(source), engine: 'duckdb' },
      order: { id: 'DESC' },
      take: 20,
    });
    for (const row of rows) {
      try {
        const config = JSON.parse(decryptConnectionConfig(row.connectionConfig));
        const origin = config.commerceSnapshot;
        // A user-replaced file is independent. Never label it as the original Commerce version.
        if (
          origin?.projectId === source.id &&
          origin.version === source.currentVersion &&
          origin.digest === source.publishedDigest &&
          config.fileVersions?.length === 1 &&
          config.connection?.filename === config.fileVersions[0].filename
        )
          return row;
      } catch {
        /* Invalid/changed metadata is never silently reused. */
      }
    }
  }
  private response(row: Database, source: CommerceSource, currency: string) {
    return {
      status: 'SUCCESS',
      data: {
        sourceId: row.id,
        commerceProjectId: source.id,
        version: source.currentVersion,
        currency,
        timeBasis: 'order-cohort',
      },
    };
  }
  private async prepare(actor: number, source: CommerceSource) {
    // query validates the managed filename before any raw file path is used.
    const currencies = (
      await this.duckdb.query(
        source.publishedFilename,
        'SELECT DISTINCT currency FROM commerce_orders',
      )
    ).datas;
    if (currencies.length !== 1 || !['USD', 'KRW'].includes(String(currencies[0].currency)))
      throw new CommerceStudioInputError('USD 또는 KRW 단일 통화 데이터만 연결할 수 있습니다.');
    const currency = String(currencies[0].currency);
    const existing = await this.existing(actor, source, this.db.manager);
    if (existing) {
      const config = JSON.parse(decryptConnectionConfig(existing.connectionConfig));
      const count = await this.duckdb.query(
        config.connection.filename,
        'SELECT count(*) AS n FROM uploaded_data',
      );
      if (String(count.datas[0]?.n) !== String(config.fileVersions[0].rows))
        throw new ServiceUnavailableException('연결한 데이터의 행 수가 달라졌습니다.');
      const current = await this.source(actor, source.id);
      if (
        current.currentVersion !== source.currentVersion ||
        current.publishedDigest !== source.publishedDigest ||
        current.publishedFilename !== source.publishedFilename
      )
        throw new ConflictException('데이터가 변경됐습니다. 현재 버전으로 다시 연결해 주세요.');
      return this.response(existing, source, currency);
    }
    const directory = path.dirname(source.publishedFilename);
    const files = {
      orders: path.join(directory, 'orders.csv'),
      payments: path.join(directory, 'payments.csv'),
      refunds: path.join(directory, 'refunds.csv'),
    };
    const customers = path.join(directory, 'customers.csv');
    const customerFile = await fs.stat(customers).catch(error => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    const imported = await this.duckdb.importCommerce({
      files: { ...files, ...(customerFile ? { customers } : {}) },
      analytical: true,
    });
    let saved: Database;
    try {
      if (!imported.validation.valid)
        throw new CommerceStudioInputError(
          '보관된 파일 검증에 실패했습니다. 원본 프로젝트를 확인해 주세요.',
        );
      let created = false;
      const row = await metadataTransaction(this.db, async manager => {
        // Lock before the first consistent read so another MySQL creator cannot insert from an old snapshot.
        const current = await this.source(actor, source.id, manager, true);
        if (
          current.currentVersion !== source.currentVersion ||
          current.publishedDigest !== source.publishedDigest ||
          current.publishedFilename !== source.publishedFilename
        )
          throw new ConflictException(
            '준비 중 데이터가 변경됐습니다. 현재 버전으로 다시 연결해 주세요.',
          );
        const prior = await this.existing(actor, source, manager);
        if (prior) return prior;
        saved = await manager.save(Database, {
          ownerId: actor,
          name: `${source.name} · v${source.currentVersion} · ${currency} · 주문일 코호트`,
          description: this.tag(source),
          engine: 'duckdb',
          type: 'duckdb',
          timezone: 'UTC',
          connectionConfig: encryptConnectionConfig(
            JSON.stringify({
              client: 'duckdb',
              connection: { filename: imported.filename },
              commerceSnapshot: {
                projectId: source.id,
                version: source.currentVersion,
                digest: source.publishedDigest,
                currency,
                timeBasis: 'order-cohort',
              },
              fileVersions: [
                {
                  id: path.basename(path.dirname(imported.filename)),
                  filename: imported.filename,
                  originalname: 'commerce-order-cohort',
                  rows: imported.rows.orders,
                  uploadedAt: new Date().toISOString(),
                  sha256: source.publishedDigest,
                },
              ],
            }),
          ),
        });
        created = true;
        return saved;
      });
      if (created)
        await this.duckdb.registerImport(imported.filename, row.id).catch(() => undefined);
      else await this.duckdb.discardImport(imported.filename);
      return this.response(row, source, currency);
    } catch (error) {
      // A callback result does not prove commit. Check this exact file's durable owner before cleanup.
      if (!saved) await this.duckdb.discardImport(imported.filename);
      else {
        try {
          const durable = await this.db.manager.findOne(Database, {
            where: { id: saved.id, ownerId: actor },
          });
          if (!durable) await this.duckdb.discardImport(imported.filename);
          else {
            const config = JSON.parse(decryptConnectionConfig(durable.connectionConfig));
            if (config.connection?.filename === imported.filename)
              await this.duckdb
                .registerImport(imported.filename, durable.id)
                .catch(() => undefined);
            else await this.duckdb.discardImport(imported.filename);
          }
        } catch {
          // If the durable read itself fails, retain the file rather than deleting possibly committed data.
        }
      }
      throw error;
    }
  }
}
