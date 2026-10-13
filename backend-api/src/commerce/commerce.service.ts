import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DuckDBService } from '../analysis/duckdb.service';
import { AiService } from '../ai/ai.service';
import { CODEX_MODEL } from '../ai/coding-agent';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { CommerceRun } from './entities/commerce-run.entity';
import { CommerceSource } from './entities/commerce-source.entity';

type Uploaded = { path?: string; originalname?: string; size?: number };
type ImportResult = {
  filename: string;
  rows: Record<string, number>;
  summary?: { salesMinor: number; refundMinor: number; orderCount: number };
  validation: {
    valid: boolean;
    errors: Array<{ code: string; rowId: string; detail: string }>;
    errorCount: number;
  };
  sampleType: 'normal' | 'error';
};
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const minorUnits = (value: unknown): bigint => BigInt(String(value ?? 0));
const money = (minor: bigint): string => {
  const negative = minor < BigInt(0);
  const absolute = negative ? -minor : minor;
  return `${negative ? '-' : ''}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(
    2,
    '0',
  )}`;
};

@Injectable()
export class CommerceService {
  private readonly sampleRequests = new Map<number, Promise<any>>();
  constructor(
    @InjectRepository(CommerceSource) private readonly sources: Repository<CommerceSource>,
    @InjectRepository(CommerceRun) private readonly runs: Repository<CommerceRun>,
    private readonly duckdb: DuckDBService,
    private readonly ai: AiService,
  ) {}

  openSample(ownerId: number) {
    const pending = this.sampleRequests.get(ownerId);
    if (pending) return pending;
    const request = this.installSample(ownerId).finally(() => this.sampleRequests.delete(ownerId));
    this.sampleRequests.set(ownerId, request);
    return request;
  }

  private async installSample(ownerId: number) {
    const bundled: Record<string, Uploaded[]> = {};
    for (const key of ['orders', 'payments', 'refunds', 'customers']) {
      bundled[key] = [{ path: path.join(__dirname, 'samples', `${key}.csv`) }];
    }
    const digest = await this.digestBundle(bundled, 'normal');
    const existing = await this.sources.findOne({
      where: { ownerId, status: 'ready', publishedDigest: digest },
    });
    if (existing)
      return { status: ResponseStatus.SUCCESS, data: { projectId: existing.id, reused: true } };
    const incoming = path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads', 'commerce-incoming');
    await fs.mkdir(incoming, { recursive: true, mode: 0o700 });
    const files: Record<string, Uploaded[]> = {};
    try {
      for (const key of Object.keys(bundled)) {
        const destination = path.join(incoming, randomUUID());
        files[key] = [{ path: destination, originalname: `${key}.csv` }];
        await fs.copyFile(bundled[key][0].path, destination);
      }
      return await this.createAndImport(ownerId, '매출·환불 샘플 · AE 합성 데이터', files);
    } finally {
      await this.cleanupUploads(files);
    }
  }

  async createSource(ownerId: number, name: string) {
    const clean = typeof name === 'string' ? name.trim() : '';
    if (!clean || clean.length > 160)
      throw new BadRequestException('name must be 1–160 characters');
    const source = await this.sources.save(
      this.sources.create({ ownerId, name: clean, status: 'empty' }),
    );
    return {
      status: ResponseStatus.SUCCESS,
      data: { id: source.id, name: source.name, status: source.status },
    };
  }

  async listSources(ownerId: number) {
    const rows = await this.sources.find({ where: { ownerId }, order: { updatedAt: 'DESC' } });
    return {
      status: ResponseStatus.SUCCESS,
      data: rows.map(row => ({
        id: row.id,
        name: row.name,
        status: row.status,
        summary: row.summaryJson ? JSON.parse(row.summaryJson) : null,
        updatedAt: row.updatedAt,
      })),
    };
  }

  private async owned(ownerId: number, id: number) {
    const source = await this.sources.findOne({ where: { id } });
    if (!source) throw new NotFoundException('commerce source not found');
    if (source.ownerId !== ownerId) throw new ForbiddenException('commerce source access denied');
    return source;
  }

  private async digestBundle(files: Record<string, Uploaded[]>, sampleType: string) {
    const hash = createHash('sha256');
    hash.update('commerce-csv-v1\0');
    hash.update(`${sampleType}\0`);
    for (const key of ['orders', 'payments', 'refunds', 'customers']) {
      const file = files[key]?.[0];
      if (!file?.path) continue;
      hash.update(`${key}\0`);
      const stream = createReadStream(file.path);
      for await (const chunk of stream) hash.update(chunk);
      hash.update('\0');
    }
    return hash.digest('hex');
  }

  private async cleanupUploads(files: Record<string, Uploaded[]>) {
    const incomingRoot = path.resolve(
      process.env.FILE_UPLOAD_DIR || 'uploads',
      'commerce-incoming',
    );
    await Promise.all(
      Object.values(files)
        .flat()
        .map(file => {
          const filename = file?.path;
          if (!filename) return undefined;
          const resolved = path.resolve(filename);
          const relative = path.relative(incomingRoot, resolved);
          if (
            !relative ||
            relative === '..' ||
            relative.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relative)
          )
            return undefined;
          return import('fs/promises').then(async fs => {
            try {
              const stat = await fs.lstat(resolved);
              if (stat.isFile()) await fs.unlink(resolved);
            } catch (error) {
              if (error?.code !== 'ENOENT') throw error;
            }
          });
        }),
    );
  }

  async importBundle(
    ownerId: number,
    sourceId: number,
    files: Record<string, Uploaded[]>,
    sampleType: 'normal' | 'error' = 'normal',
  ) {
    try {
      return await this.importBundleOwned(ownerId, sourceId, files, sampleType);
    } finally {
      await this.cleanupUploads(files || {});
    }
  }

  private async importBundleOwned(
    ownerId: number,
    sourceId: number,
    files: Record<string, Uploaded[]>,
    sampleType: 'normal' | 'error',
  ) {
    const source = await this.owned(ownerId, sourceId);
    if (!['normal', 'error'].includes(sampleType))
      throw new BadRequestException('sampleType must be normal or error');
    const present = ['orders', 'payments', 'refunds', 'customers'].filter(key => files[key]?.[0]);
    if (!files.orders?.[0] || !files.payments?.[0] || !files.refunds?.[0]) {
      throw new BadRequestException('orders, payments, and refunds files are required');
    }
    const inputDigest = await this.digestBundle(files, sampleType);
    const expectedVersion = Number(source.currentVersion || 0);
    const run = await this.runs.save(
      this.runs.create({ ownerId, sourceId, status: 'running', inputDigest, expectedVersion }),
    );
    try {
      const importer = (this.duckdb as any).importCommerce;
      if (typeof importer !== 'function')
        throw new ServiceUnavailableException('commerce import worker is unavailable');
      const result: ImportResult = await importer.call(this.duckdb, {
        files: Object.fromEntries(present.map(key => [key, files[key][0].path])),
        sampleType,
      });
      if (!result || typeof result.validation?.valid !== 'boolean')
        throw new Error('worker returned an invalid import result');
      if (!result.validation.valid) {
        await this.duckdb.removeImport(result.filename);
        await this.runs.update(run.id, {
          status: 'rejected',
          resultJson: JSON.stringify({
            valid: false,
            rows: result.rows,
            sampleType: result.sampleType,
            validation: result.validation,
          }),
        });
        throw new BadRequestException({
          message: 'Commerce bundle failed validation; no report was published.',
          runId: run.id,
          state: 'rejected',
          validation: result.validation,
        });
      }
      const current = await this.owned(ownerId, sourceId);
      if (current.publishedDigest === inputDigest) {
        await this.duckdb.removeImport(result.filename);
        await this.cleanupUploads(files);
        await this.runs.update(run.id, {
          status: 'noop',
          publishedVersion: current.currentVersion,
          resultJson: JSON.stringify({ valid: true, noOp: true, sampleType: result.sampleType }),
        });
        return {
          status: ResponseStatus.SUCCESS,
          data: {
            runId: run.id,
            state: 'noop',
            changed: false,
            projectId: sourceId,
            version: current.currentVersion,
            digest: inputDigest,
            sampleType: result.sampleType,
          },
        };
      }
      if (Number(current.currentVersion || 0) !== expectedVersion) {
        await this.duckdb.removeImport(result.filename);
        await this.runs.update(run.id, {
          status: 'superseded',
          errorMessage: 'A newer import was published first.',
        });
        throw new ConflictException(
          'A newer import was published first; this result was discarded.',
        );
      }
      const nextVersion = expectedVersion + 1;
      const publication = await this.sources.update(
        { id: sourceId, ownerId, currentVersion: expectedVersion },
        {
          publishedFilename: result.filename,
          publishedDigest: inputDigest,
          currentVersion: nextVersion,
          summaryJson: JSON.stringify({
            rows: result.rows,
            summary: result.summary,
            sampleType: result.sampleType,
          }),
          status: 'ready',
        },
      );
      if (publication.affected !== 1) {
        await this.duckdb.removeImport(result.filename);
        await this.runs.update(run.id, {
          status: 'superseded',
          errorMessage: 'A newer import was published first.',
        });
        throw new ConflictException(
          'A newer import was published first; this result was discarded.',
        );
      }
      await this.runs.update(run.id, {
        status: 'succeeded',
        publishedVersion: nextVersion,
        resultJson: JSON.stringify({
          valid: true,
          rows: result.rows,
          sampleType: result.sampleType,
          version: nextVersion,
          digest: inputDigest,
        }),
      });
      return {
        status: ResponseStatus.SUCCESS,
        data: {
          runId: run.id,
          state: 'succeeded',
          sourceId,
          projectId: sourceId,
          version: nextVersion,
          digest: inputDigest,
          changed: true,
          rows: result.rows,
          sampleType: result.sampleType,
        },
      };
    } catch (error) {
      const response = error?.getResponse?.();
      const rejected = response && typeof response === 'object' && response.state === 'rejected';
      const latest = await this.runs.findOne({ where: { id: run.id } });
      if (!['rejected', 'superseded', 'noop'].includes(latest?.status)) {
        await this.runs.update(run.id, {
          status: rejected ? 'rejected' : 'failed',
          errorMessage: rejected
            ? 'Commerce bundle failed validation.'
            : String(error?.message || 'commerce import failed').slice(0, 500),
        });
      }
      throw error;
    }
  }

  async listProjects(ownerId: number) {
    const items = await this.sources.find({
      where: { ownerId, status: 'ready' },
      order: { updatedAt: 'DESC' },
    });
    return {
      status: ResponseStatus.SUCCESS,
      data: items.map(item => ({
        id: item.id,
        name: item.name,
        version: Number(item.currentVersion || 0),
        digest: item.publishedDigest,
        presentation: item.presentationJson ? JSON.parse(item.presentationJson) : {},
        updatedAt: item.updatedAt,
      })),
    };
  }

  async createAndImport(
    ownerId: number,
    name: string,
    files: Record<string, Uploaded[]>,
    sampleType: 'normal' | 'error' = 'normal',
    projectId?: number,
  ) {
    let sourceId: number | undefined;
    const clean = typeof name === 'string' ? name.trim() : '';
    try {
      if (!clean || clean.length > 160)
        throw new BadRequestException('name must be 1–160 characters');
      if (projectId !== undefined) {
        if (!Number.isInteger(projectId) || projectId <= 0)
          throw new BadRequestException('projectId must be a positive integer');
        await this.owned(ownerId, projectId);
        sourceId = projectId;
      } else {
        const created = await this.createSource(ownerId, clean);
        sourceId = created.data.id;
      }
      const result = await this.importBundle(ownerId, sourceId, files, sampleType);
      return {
        status: ResponseStatus.SUCCESS,
        data: {
          ...result.data,
          projectId: sourceId,
          project: { id: sourceId, name: clean },
        },
      };
    } catch (error) {
      if (projectId === undefined && sourceId !== undefined)
        await this.sources.delete({ id: sourceId, ownerId, status: 'empty', currentVersion: 0 });
      throw error;
    } finally {
      await this.cleanupUploads(files || {});
    }
  }

  async getRun(ownerId: number, id: number) {
    const run = await this.runs.findOne({ where: { id } });
    if (!run) throw new NotFoundException('commerce run not found');
    if (run.ownerId !== ownerId) throw new ForbiddenException('commerce run access denied');
    return {
      status: ResponseStatus.SUCCESS,
      data: {
        runId: run.id,
        sourceId: run.sourceId,
        state: run.status,
        result: run.resultJson ? JSON.parse(run.resultJson) : null,
        error: run.errorMessage || null,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      },
    };
  }

  async report(ownerId: number, sourceId: number, from: string, to: string, channel?: string) {
    const source = await this.owned(ownerId, sourceId);
    if (!source.publishedFilename || source.status !== 'ready')
      throw new BadRequestException('commerce source has no published dataset');
    if (!validDate(from) || !validDate(to) || from > to)
      throw new BadRequestException('from and to must be valid ordered YYYY-MM-DD dates');
    const query = async (sql: string, bindings: unknown[]) => {
      const placeholders = (sql.match(/\?/g) || []).length;
      if (placeholders !== bindings.length)
        throw new Error(`commerce report binding mismatch (${placeholders}/${bindings.length})`);
      return (await this.duckdb.query(source.publishedFilename, sql, bindings)).datas;
    };
    if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 3660) {
      throw new BadRequestException('date range cannot exceed 10 years');
    }
    const channelClause = channel ? ` AND COALESCE(o.channel, 'Unassigned') = ?` : '';
    const withChannel = (values: unknown[]) => (channel ? [...values, channel] : values);
    const availableChannels = await query(
      `SELECT DISTINCT COALESCE(channel,'Unassigned') AS channel FROM commerce_orders ORDER BY channel`,
      [],
    );
    if (channel && !availableChannels.some((item: any) => item.channel === channel))
      throw new BadRequestException('channel is not available for this source');
    const start = `${from} 00:00:00+00`;
    const endExclusive = `${new Date(Date.parse(`${to}T00:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10)} 00:00:00+00`;
    const [kpi, daily, channels, refundReasons, orders, cohort] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(p.amount_minor),0) AS paymentMinor FROM commerce_payments p JOIN commerce_orders o USING(order_id) WHERE p.payment_status='succeeded' AND p.paid_at>=? AND p.paid_at<?${channelClause}`,
        withChannel([start, endExclusive]),
      ),
      query(
        `WITH days AS (SELECT CAST(generate_series AS DATE) AS day_key FROM generate_series(CAST(? AS DATE), CAST(? AS DATE), INTERVAL 1 DAY)), p AS (SELECT CAST(p.paid_at AS DATE) AS day_key, SUM(p.amount_minor) total FROM commerce_payments p JOIN commerce_orders o USING(order_id) WHERE p.payment_status='succeeded' AND p.paid_at>=? AND p.paid_at<?${channelClause} GROUP BY 1), r AS (SELECT CAST(r.refunded_at AS DATE) AS day_key, SUM(r.merchandise_refund_minor) total FROM commerce_refunds r JOIN commerce_orders o USING(order_id) WHERE r.refunded_at>=? AND r.refunded_at<?${channelClause} GROUP BY 1) SELECT CAST(d.day_key AS VARCHAR) AS date, CAST(COALESCE(p.total,0) AS VARCHAR) AS paymentMinor, CAST(COALESCE(r.total,0) AS VARCHAR) AS refundMinor, CAST(COALESCE(p.total,0)-COALESCE(r.total,0) AS VARCHAR) AS netMinor FROM days d LEFT JOIN p USING(day_key) LEFT JOIN r USING(day_key) ORDER BY d.day_key`,
        [from, to, ...withChannel([start, endExclusive]), ...withChannel([start, endExclusive])],
      ),
      query(
        `WITH p AS (SELECT COALESCE(o.channel,'Unassigned') channel, SUM(p.amount_minor) total FROM commerce_payments p JOIN commerce_orders o USING(order_id) WHERE p.payment_status='succeeded' AND p.paid_at>=? AND p.paid_at<?${channelClause} GROUP BY 1), r AS (SELECT COALESCE(o.channel,'Unassigned') channel, SUM(r.merchandise_refund_minor) total FROM commerce_refunds r JOIN commerce_orders o USING(order_id) WHERE r.refunded_at>=? AND r.refunded_at<?${channelClause} GROUP BY 1) SELECT COALESCE(p.channel,r.channel) AS channel, CAST(COALESCE(p.total,0) AS VARCHAR) AS paymentMinor, CAST(COALESCE(r.total,0) AS VARCHAR) AS refundMinor, CAST(COALESCE(p.total,0)-COALESCE(r.total,0) AS VARCHAR) AS netMinor FROM p FULL OUTER JOIN r USING(channel) ORDER BY COALESCE(p.total,0)-COALESCE(r.total,0) DESC`,
        [...withChannel([start, endExclusive]), ...withChannel([start, endExclusive])],
      ),
      query(
        `SELECT r.refund_reason AS reason, CAST(SUM(r.merchandise_refund_minor) AS VARCHAR) AS refundMinor, COUNT(*) AS refunds FROM commerce_refunds r JOIN commerce_orders o USING(order_id) WHERE r.refunded_at>=? AND r.refunded_at<?${channelClause} GROUP BY r.refund_reason ORDER BY SUM(r.merchandise_refund_minor) DESC`,
        withChannel([start, endExclusive]),
      ),
      query(
        `SELECT o.order_id AS orderId, strftime(o.ordered_at AT TIME ZONE 'UTC','%Y-%m-%dT%H:%M:%SZ') AS orderedAt, COALESCE(o.channel,'Unassigned') AS channel, o.order_status AS orderStatus, CAST(COALESCE(p.paid_amount,0) AS VARCHAR) AS paidMinor, CAST(COALESCE(r.refund_amount,0) AS VARCHAR) AS refundMinor, CAST(COALESCE(p.paid_amount,0)-COALESCE(r.refund_amount,0) AS VARCHAR) AS netMinor FROM commerce_orders o LEFT JOIN (SELECT order_id, SUM(amount_minor) paid_amount FROM commerce_payments WHERE payment_status='succeeded' GROUP BY order_id) p USING(order_id) LEFT JOIN (SELECT order_id, SUM(merchandise_refund_minor) refund_amount FROM commerce_refunds GROUP BY order_id) r USING(order_id) WHERE o.ordered_at>=? AND o.ordered_at<?${channelClause} ORDER BY o.ordered_at DESC LIMIT 100`,
        withChannel([start, endExclusive]),
      ),
      query(
        `SELECT COUNT(DISTINCT o.order_id) AS paidOrders, COUNT(DISTINCT r.order_id) AS refundedOrders FROM commerce_orders o JOIN (SELECT DISTINCT order_id FROM commerce_payments WHERE payment_status='succeeded') p USING(order_id) LEFT JOIN (SELECT DISTINCT order_id FROM commerce_refunds) r USING(order_id) WHERE o.ordered_at>=? AND o.ordered_at<?${channelClause}`,
        withChannel([start, endExclusive]),
      ),
    ]);
    const refundTotals = await query(
      `SELECT COALESCE(SUM(r.merchandise_refund_minor),0) AS refundMinor FROM commerce_refunds r JOIN commerce_orders o USING(order_id) WHERE r.refunded_at>=? AND r.refunded_at<?${channelClause}`,
      withChannel([start, endExclusive]),
    );
    const salesMinor = minorUnits(kpi?.[0]?.paymentMinor);
    const refundMinor = minorUnits(refundTotals?.[0]?.refundMinor);
    const sales = money(salesMinor);
    const refund = money(refundMinor);
    const orderCount = Number(cohort?.[0]?.paidOrders || 0);
    const refundedOrders = Number(cohort?.[0]?.refundedOrders || 0);
    const available = await query(
      `SELECT CAST(min(day_value) AS DATE) AS start, CAST(max(day_value) AS DATE) AS end FROM (SELECT ordered_at AS day_value FROM commerce_orders UNION ALL SELECT paid_at AS day_value FROM commerce_payments WHERE payment_status='succeeded' UNION ALL SELECT refunded_at AS day_value FROM commerce_refunds)`,
      [],
    );
    const actualFrom = from || String(available?.[0]?.start || '').slice(0, 10);
    const actualTo = to || String(available?.[0]?.end || '').slice(0, 10);
    const presentation = source.presentationJson ? JSON.parse(source.presentationJson) : {};
    const items = JSON.parse(source.summaryJson || '{}');
    return {
      status: ResponseStatus.SUCCESS,
      data: {
        project: {
          id: source.id,
          name: source.name,
          version: Number(source.currentVersion || 0),
          digest: source.publishedDigest,
          presentation,
        },
        summary: {
          paymentTotal: sales,
          refundTotal: refund,
          netCollected: money(salesMinor - refundMinor),
          paidOrders: orderCount,
          refundedOrders,
          refundOrderRate: orderCount ? refundedOrders / orderCount : null,
        },
        daily: daily.map((row: any) => ({
          date: row.date,
          paymentTotal: money(minorUnits(row.paymentMinor)),
          refundTotal: money(minorUnits(row.refundMinor)),
          netCollected: money(minorUnits(row.netMinor)),
        })),
        channels: channels.map((row: any) => ({
          channel: row.channel,
          paymentTotal: money(minorUnits(row.paymentMinor)),
          refundTotal: money(minorUnits(row.refundMinor)),
          netCollected: money(minorUnits(row.netMinor)),
        })),
        reasons: refundReasons.map((row: any) => ({
          reason: row.reason,
          refundTotal: money(minorUnits(row.refundMinor)),
          refunds: Number(row.refunds),
        })),
        orders: orders.map((row: any) => ({
          orderId: row.orderId,
          orderedAt: row.orderedAt,
          channel: row.channel,
          orderStatus: row.orderStatus,
          paidAmount: money(minorUnits(row.paidMinor)),
          refundAmount: money(minorUnits(row.refundMinor)),
          netCollected: money(minorUnits(row.netMinor)),
        })),
        availableChannels: availableChannels.map((row: any) => row.channel),
        range: {
          start: String(available?.[0]?.start || '').slice(0, 10),
          end: String(available?.[0]?.end || '').slice(0, 10),
          timezone: 'UTC',
        },
        scope: {
          refundData: true,
          sampleType: items.sampleType || 'normal',
          currency: 'USD',
          paymentAndRefundTotalsByEventDate: true,
          refundOrderRateByOrderDateCohort: true,
          start: actualFrom,
          end: actualTo,
          truncated: { orders: orders.length === 100 },
        },
      },
    };
  }

  async frontendReport(
    ownerId: number,
    sourceId: number,
    from?: string,
    to?: string,
    channel?: string,
  ) {
    const source = await this.owned(ownerId, sourceId);
    if (!source.publishedFilename || source.status !== 'ready')
      throw new BadRequestException('commerce source has no published dataset');
    if (Boolean(from) !== Boolean(to))
      throw new BadRequestException('from and to must be supplied together');
    const dates = await this.duckdb.query(
      source.publishedFilename,
      `SELECT CAST(min(day_value) AS DATE) AS min_day, CAST(max(day_value) AS DATE) AS max_day FROM (SELECT ordered_at AS day_value FROM commerce_orders UNION ALL SELECT paid_at AS day_value FROM commerce_payments WHERE payment_status='succeeded' UNION ALL SELECT refunded_at AS day_value FROM commerce_refunds)`,
    );
    const start = from || String(dates.datas?.[0]?.min_day || '').slice(0, 10);
    const end = to || String(dates.datas?.[0]?.max_day || '').slice(0, 10);
    if (!validDate(start) || !validDate(end) || start > end)
      throw new BadRequestException('from and to must be valid ordered YYYY-MM-DD dates');
    const result = await this.report(ownerId, sourceId, start, end, channel);
    return result;
  }

  async aiDraft(
    ownerId: number,
    sourceId: number,
    body: {
      prompt: string;
      currentPresentation?: any;
      start?: string;
      end?: string;
      channel?: string;
    },
  ) {
    if (typeof body?.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 1000)
      throw new BadRequestException('prompt must be 1–1000 characters');
    if (process.env.AI_PROVIDER !== 'codex')
      throw new ServiceUnavailableException(
        'Commerce AI presentation requires the configured Codex gpt-6-luna provider',
      );
    const current = body.currentPresentation ?? {};
    if (!current || typeof current !== 'object' || Array.isArray(current))
      throw new BadRequestException('currentPresentation must be an object');
    const currentPresentation: Record<string, string> = {};
    for (const [key, max] of [
      ['title', 200],
      ['explanation', 2000],
      ['chartTitle', 200],
    ] as const) {
      if (current[key] !== undefined && typeof current[key] !== 'string')
        throw new BadRequestException(`currentPresentation.${key} must be a string`);
      if (typeof current[key] === 'string') currentPresentation[key] = current[key].slice(0, max);
    }
    const report = await this.frontendReport(ownerId, sourceId, body.start, body.end, body.channel);
    const system =
      'Return only JSON with exactly title, explanation, chartTitle string properties. Write concise Korean labels. Use only supplied aggregate values and definitions; do not infer trends from omitted daily data, or claim profit, causes, or results not present in the data. Refund history is limited to the uploaded dataset: explicitly say 확보한 데이터 범위 내 환불 이력, never 평생 or complete lifetime history. chartTitle describes only the daily cash chart: paymentTotal, refundTotal, netCollected in USD. Refund rate and order counts are separate KPI cards and are not plotted on that chart; never include them in chartTitle.';
    const aiReport = {
      chart: {
        series: ['paymentTotal', 'refundTotal', 'netCollected'],
        unit: 'USD',
        timeBasis: 'UTC event date',
      },
      project: report.data.project,
      summary: report.data.summary,
      channels: report.data.channels,
      reasons: report.data.reasons,
      range: report.data.range,
      scope: report.data.scope,
      definitions: {
        currency: 'USD',
        paymentTotal:
          'Successful payment amounts summed by paid_at within the selected UTC date range.',
        refundTotal:
          'Recorded refund amounts summed by refunded_at within the selected UTC date range; separate tax and shipping refund allocations are unavailable.',
        netCollected: 'paymentTotal minus refundTotal, calculated in integer cents.',
        refundOrderRate:
          'Distinct refunded orders divided by successful-payment orders in the ordered_at cohort; refund membership is lifetime within the published bundle.',
      },
    };
    const raw = await this.ai.callLlm(
      system,
      JSON.stringify({
        instruction: body.prompt,
        existing: currentPresentation,
        report: aiReport,
      }),
      true,
    );
    let draft: any;
    try {
      draft = JSON.parse(raw);
    } catch {
      throw new ServiceUnavailableException('AI returned invalid draft JSON');
    }
    if (['title', 'explanation', 'chartTitle'].some(key => typeof draft?.[key] !== 'string'))
      throw new ServiceUnavailableException('AI returned an invalid draft shape');
    return { status: ResponseStatus.SUCCESS, data: { draft, requestedModel: CODEX_MODEL } };
  }

  async savePresentation(ownerId: number, sourceId: number, presentation: any) {
    await this.owned(ownerId, sourceId);
    if (
      !presentation ||
      ['title', 'explanation', 'chartTitle'].some(key => typeof presentation[key] !== 'string')
    )
      throw new BadRequestException('presentation requires title, explanation, and chartTitle');
    const presentationJson = JSON.stringify({
      title: presentation.title.slice(0, 200),
      explanation: presentation.explanation.slice(0, 2000),
      chartTitle: presentation.chartTitle.slice(0, 200),
    });
    const updated = await this.sources.update({ id: sourceId, ownerId }, { presentationJson });
    if (updated.affected !== 1) throw new NotFoundException('commerce source not found');
    return {
      status: ResponseStatus.SUCCESS,
      data: { presentation: JSON.parse(presentationJson) },
    };
  }
}
