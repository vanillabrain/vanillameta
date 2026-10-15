import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { DuckDBService } from '../analysis/duckdb.service';
import { Database } from '../database/entities/database.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { ConnectionService } from '../connection/connection.service';
import { encryptConnectionConfig } from '../utils/crypto.util';
import { studioKeys } from './studio-document';

const RILL = {
  url: 'https://storage.googleapis.com/rilldata-public/auction_data.parquet',
  sha256: '7549d18b0294932802407f6bd851a807ff88ba1406b2958bbd8b4c261a4ee157',
};
@Injectable()
export class StudioSampleService {
  private pending = new Map<string, Promise<any>>();
  constructor(
    private readonly db: DataSource,
    private readonly duckdb: DuckDBService,
    private readonly access: SourceAccessService,
    private readonly connection: ConnectionService,
  ) {}
  async sample(body: any, actor: number) {
    this.access.actor(actor);
    try {
      studioKeys(body, ['sample']);
    } catch {
      throw new BadRequestException('샘플을 선택해 주세요.');
    }
    if (typeof body.sample !== 'string' || !['rill', 'commerce'].includes(body.sample))
      throw new BadRequestException('샘플을 선택해 주세요.');
    const key = actor + ':' + body.sample;
    const previous = this.pending.get(key);
    if (previous) return previous;
    if (this.pending.size >= 16)
      throw new ServiceUnavailableException('샘플 준비 요청이 많습니다.');
    const promise = this.install(body.sample, actor).finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
  private async oracle(sample: string, query: (sql: string) => Promise<any>) {
    const sql =
      sample === 'rill'
        ? 'SELECT COUNT(*) AS n, SUM(bid_request_cnt) AS requests, SUM(bid_floor)/SUM(has_bid_floor_cnt) AS average FROM uploaded_data'
        : 'SELECT COUNT(*) AS n, SUM(revenue) AS sales, SUM(refund_amount) AS refund, SUM(net_amount) AS net FROM uploaded_data';
    const row = (await query(sql)).datas[0];
    const cents = (value: unknown) => {
      const parts = /^(-?)([0-9]+)(?:\.([0-9]{1,2}))?$/.exec(String(value));
      if (!parts) return undefined;
      return (
        (parts[1] === '-' ? -BigInt(1) : BigInt(1)) *
        (BigInt(parts[2]) * BigInt(100) + BigInt((parts[3] || '').padEnd(2, '0')))
      );
    };
    if (
      sample === 'rill'
        ? Number(row.n) !== 1391572 ||
          Number(row.requests) !== 634513000 ||
          !Number.isFinite(Number(row.average)) ||
          Math.abs(Number(row.average) - 5.571238676526892) > 1e-9
        : Number(row.n) !== 37 ||
          cents(row.sales) !== BigInt(2099461) ||
          cents(row.refund) !== BigInt(445760) ||
          cents(row.net) !== BigInt(1653701)
    )
      throw new ServiceUnavailableException(
        '샘플이 고정된 수치 기준과 다릅니다. 다른 데이터로 대체하지 않았습니다.',
      );
  }
  private async rillBytes() {
    const candidates = [
      path.resolve(process.cwd(), '../samples/rill/auction_data.parquet'),
      path.resolve(process.cwd(), 'samples/rill/auction_data.parquet'),
      '/tmp/vanillameta-rill-demo/auction_data.parquet',
    ];
    for (const file of candidates) {
      const bytes = await fs.readFile(file).catch(() => undefined);
      if (bytes) {
        if (createHash('sha256').update(bytes).digest('hex') !== RILL.sha256)
          throw new ServiceUnavailableException('공식 Rill 샘플 checksum이 다릅니다.');
        return bytes;
      }
    }
    try {
      const response = await axios.get(RILL.url, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 64 * 1024 * 1024,
        maxBodyLength: 64 * 1024 * 1024,
        maxRedirects: 0,
      });
      const bytes = Buffer.from(response.data);
      if (createHash('sha256').update(bytes).digest('hex') !== RILL.sha256)
        throw new Error('checksum');
      return bytes;
    } catch {
      throw new ServiceUnavailableException(
        '공식 Rill 샘플 다운로드 또는 checksum 검증에 실패했습니다.',
      );
    }
  }
  private async install(sample: string, actor: number) {
    const tag =
      'studio-sample:' +
      (sample === 'rill' ? 'rill-auction-' + RILL.sha256 : 'ae-commerce-demo-v1-order-cohort');
    const existing = await this.db.manager.findOne(Database, {
      where: { ownerId: actor, description: tag, engine: 'duckdb' },
    });
    if (existing) {
      await this.access.assert('database', existing.id, actor);
      await this.connection.withDuckDBSnapshot(existing.id, () =>
        this.oracle(sample, sql => this.connection.queryDuckDB(existing.id, sql)),
      );
      return { sourceId: existing.id, name: existing.name };
    }
    let imported: { filename: string; rows?: any }, checksum: string;
    const name =
      sample === 'rill' ? 'Rill 공식 Auction 샘플' : '매출·환불 샘플 · 37주문 · 주문일 코호트';
    if (sample === 'rill') {
      imported = await this.duckdb.importFile({
        originalname: 'auction_data.parquet',
        buffer: await this.rillBytes(),
      });
      checksum = RILL.sha256;
    } else {
      // Reuse the bundled, attributed 37-order fixture. The 99,827-order oracle is a different dataset.
      const directory = path.resolve(
        process.env.FILE_UPLOAD_DIR || 'uploads',
        'studio-incoming',
        randomUUID(),
      );
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      try {
        const bundled = path.join(__dirname, '../commerce/samples');
        const manifest = JSON.parse(await fs.readFile(path.join(bundled, 'manifest.json'), 'utf8'));
        const files: any = {};
        for (const key of ['orders', 'payments', 'refunds', 'customers']) {
          const bytes = await fs.readFile(path.join(bundled, key + '.csv'));
          if (createHash('sha256').update(bytes).digest('hex') !== manifest.sha256[key])
            throw new ServiceUnavailableException('커머스 샘플 checksum이 다릅니다.');
          files[key] = path.join(directory, key + '.csv');
          await fs.writeFile(files[key], bytes, { mode: 0o600 });
        }
        checksum = createHash('sha256').update(JSON.stringify(manifest.sha256)).digest('hex');
        const result = await this.duckdb.importCommerce({ files, analytical: true });
        imported = result;
        if (!result.validation.valid)
          throw new ServiceUnavailableException('커머스 샘플 검증에 실패했습니다.');
      } finally {
        await fs.rm(directory, { recursive: true, force: true });
      }
    }
    let saved: Database;
    try {
      await this.oracle(sample, sql => this.duckdb.query(imported.filename, sql));
      const rows = sample === 'rill' ? 1391572 : 37;
      saved = await this.db.manager.save(Database, {
        ownerId: actor,
        name,
        description: tag,
        engine: 'duckdb',
        type: 'duckdb',
        timezone: 'UTC',
        connectionConfig: encryptConnectionConfig(
          JSON.stringify({
            client: 'duckdb',
            connection: { filename: imported.filename },
            fileVersions: [
              {
                id: path.basename(path.dirname(imported.filename)),
                filename: imported.filename,
                originalname:
                  sample === 'rill' ? 'auction_data.parquet' : 'ae-commerce-demo-v1-order-cohort',
                rows,
                uploadedAt: new Date().toISOString(),
                sha256: checksum,
              },
            ],
          }),
        ),
      });
    } catch (error) {
      await this.duckdb.discardImport(imported.filename);
      throw error;
    }
    // Metadata remains authoritative if only the auxiliary registration manifest fails.
    await this.duckdb.registerImport(imported.filename, saved.id).catch(() => undefined);
    return { sourceId: saved.id, name: saved.name };
  }
}
