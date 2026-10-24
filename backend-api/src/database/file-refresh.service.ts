import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, In, IsNull, MoreThan } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AnalysisUpload, DuckDBService } from '../analysis/duckdb.service';
import { lockSourceActor, assertSourceOwner, sourceWriteTransaction } from './source-write-lock';
import { lockMetricSources } from '../metric/metric-write-lock';
import { ForbiddenException } from '@nestjs/common';
import { serializedViewWrite } from '../dashboard/view-write-queue';
import { SourceAccessService } from '../ownership/source-access.service';
import { Database } from './entities/database.entity';
import { FileRefresh } from './entities/file-refresh.entity';
import { DatabaseService } from './database.service';
import { FileCorrection, FILE_CORRECTION_MESSAGES } from '../analysis/file-correction';
import { decryptConnectionConfig } from '../utils/crypto.util';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const LEASE_MS = 15000;
/** Durable metadata + the existing in-process DuckDB worker; no additional queue daemon. */
@Injectable()
export class FileRefreshService implements OnModuleDestroy, OnApplicationBootstrap {
  private closing = false;
  private rerun = new Set<string>();
  private tasks = new Map<string, Promise<void>>();
  private heartbeats = new Set<ReturnType<typeof setInterval>>();
  private cancellations = new Map<string, AbortController>();
  constructor(
    private readonly db: DataSource,
    private readonly files: DatabaseService,
    private readonly worker: DuckDBService,
    private readonly access: SourceAccessService,
  ) {}
  private repository() {
    return this.db.getRepository(FileRefresh);
  }
  private patch(criteria: any, values: any) {
    return serializedViewWrite(this.repository(), () => this.repository().update(criteria, values));
  }
  private storageDigest() {
    return createHash('sha256')
      .update(path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads'))
      .digest('hex');
  }
  private async cleanupInput(id: string) {
    // An owned attempt may still be reading/copying the staged file until its worker settles.
    if (this.cancellations.has(id)) return;
    return serializedViewWrite(this.repository(), async () => {
      const job = await this.repository().findOneBy({ id });
      if (
        !job?.inputRetained ||
        !['succeeded', 'cancelled'].includes(job.status) ||
        job.storageDigest !== this.storageDigest()
      )
        return;
      try {
        await fs.rm(this.directory(id), { recursive: true, force: true });
        await this.repository().update(
          { id, inputRetained: true, status: In(['succeeded', 'cancelled']) },
          { inputRetained: false },
        );
      } catch {
        /* Retained input remains counted and cleanup is retried on read/admission/restart. */
      }
    });
  }
  private async cleanupForActor(actorId?: number) {
    const jobs = await this.repository().find({
      where: {
        ...(actorId ? { actorId } : {}),
        storageDigest: this.storageDigest(),
        inputRetained: true,
        status: In(['succeeded', 'cancelled']),
      },
      take: 50,
    });
    for (const job of jobs) await this.cleanupInput(job.id);
  }
  private async stagedAdmissions(actorId?: number) {
    const root = path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads', 'refresh-input');
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch (error: any) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const admissions: { id: string; actorId: number; createdAt: number }[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !UUID.test(entry.name)) continue;
      try {
        const raw = await fs.readFile(path.join(root, entry.name, 'admission.json'), 'utf8');
        if (raw.length > 512) continue;
        const marker = JSON.parse(raw);
        if (
          Number.isSafeInteger(marker.actorId) &&
          marker.actorId > 0 &&
          Number.isFinite(marker.createdAt) &&
          marker.storageDigest === this.storageDigest() &&
          (!actorId || actorId === marker.actorId)
        )
          admissions.push({ id: entry.name, actorId: marker.actorId, createdAt: marker.createdAt });
      } catch {
        /* A partially written marker is protected by the admission grace period. */
      }
    }
    return admissions;
  }
  private async cleanupOrphanAdmissions(actorId?: number) {
    for (const admission of await this.stagedAdmissions(actorId)) {
      // Admissions are limited to 512MiB; retain recent work while another process may commit.
      if (Date.now() - admission.createdAt < 15 * 60 * 1000) continue;
      const receipt = await this.repository().findOneBy({ id: admission.id });
      if (!receipt) {
        try {
          await fs.rm(this.directory(admission.id), { recursive: true, force: true });
        } catch {
          /* Keep failed cleanup counted for the next explicit admission. */
        }
      }
    }
  }
  private async retainedCount(actorId: number, manager = this.db.manager) {
    const retained = await manager.find(FileRefresh, {
      where: { actorId, inputRetained: true },
      select: { id: true },
    });
    const ids = new Set(retained.map(job => job.id));
    for (const admission of await this.stagedAdmissions(actorId)) ids.add(admission.id);
    return ids.size;
  }
  async onApplicationBootstrap() {
    await this.cleanupForActor();
    await this.cleanupOrphanAdmissions().catch(() => undefined);
  }
  private directory(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('작업 ID를 확인해 주세요.');
    return path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads', 'refresh-input', id);
  }
  private input(job: FileRefresh) {
    return path.join(this.directory(job.id), 'source' + job.extension);
  }
  private requestId(value: unknown) {
    if (typeof value !== 'string' || !UUID.test(value))
      throw new BadRequestException('같은 갱신 요청의 ID를 확인해 주세요.');
    return value.toLowerCase();
  }
  private async owner(sourceId: unknown, actor: number) {
    this.access.actor(actor);
    const id = this.access.id(sourceId);
    await this.access.assert('database', id, actor);
    const source = await this.db.manager.findOne(Database, {
      where: { id, ownerId: actor, engine: 'duckdb' },
    });
    if (!source) throw new NotFoundException('이 서버 파일 소스를 사용할 수 없습니다.');
    return source;
  }
  private view(job: FileRefresh) {
    return {
      id: job.id,
      requestId: job.requestId,
      sourceId: job.sourceId,
      originalname: job.originalname,
      status: job.status,
      attempts: job.attempts,
      ...(job.correction ? { correction: JSON.parse(job.correction) } : {}),
      storageAvailable: job.storageDigest === this.storageDigest(),
      ...(['succeeded', 'cancelled'].includes(job.status)
        ? { cleanupPending: job.inputRetained }
        : {}),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...(job.result ? { result: JSON.parse(job.result) } : {}),
      ...(job.error ? { error: JSON.parse(job.error) } : {}),
    };
  }
  private async expire(job: FileRefresh) {
    if (
      job.status === 'running' &&
      (!job.leaseUntil ||
        !Number.isFinite(Date.parse(job.leaseUntil)) ||
        Date.parse(job.leaseUntil) <= Date.now())
    ) {
      await this.patch(
        {
          id: job.id,
          status: 'running',
          leaseToken: job.leaseToken ?? IsNull(),
          leaseUntil: job.leaseUntil ?? IsNull(),
        },
        {
          status: 'interrupted',
          leaseToken: null,
          leaseUntil: null,
          error: JSON.stringify({
            code: 'FILE_REFRESH_INTERRUPTED',
            message:
              '이전 실행의 연결이 끊겼습니다. 마지막 성공 데이터는 유지됩니다. 같은 작업을 명시적으로 다시 실행해 주세요.',
          }),
        },
      );
      return this.repository().findOneByOrFail({ id: job.id });
    }
    return job;
  }
  async get(sourceId: unknown, request: unknown, actor: number) {
    const source = await this.owner(sourceId, actor);
    const requestId = this.requestId(request);
    const job = await this.repository().findOneBy({
      actorId: actor,
      sourceId: source.id,
      requestId,
    });
    if (!job)
      throw new NotFoundException(
        '이 갱신 요청을 찾을 수 없습니다. 파일을 다시 전송하지 않고 상태를 확인했습니다.',
      );
    if (['succeeded', 'cancelled'].includes(job.status)) {
      await this.cleanupInput(job.id);
      return this.view(await this.repository().findOneByOrFail({ id: job.id }));
    }
    return this.view(await this.expire(job));
  }
  async latest(sourceId: unknown, actor: number) {
    const source = await this.owner(sourceId, actor);
    const job = await this.repository().findOne({
      where: { actorId: actor, sourceId: source.id },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    if (job && ['succeeded', 'cancelled'].includes(job.status)) {
      await this.cleanupInput(job.id);
      return this.view(await this.repository().findOneByOrFail({ id: job.id }));
    }
    return job ? this.view(await this.expire(job)) : null;
  }
  private correction(value: unknown): FileCorrection | undefined {
    if (value === undefined || value === null) return;
    let body: any;
    try {
      body = typeof value === 'string' && value.length <= 1024 ? JSON.parse(value) : value;
    } catch {
      throw new BadRequestException('정정 설정을 확인해 주세요.');
    }
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).sort().join(',') !== 'keyColumn,updatedAtColumn' ||
      ['keyColumn', 'updatedAtColumn'].some(
        key => typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 128,
      ) ||
      body.keyColumn === body.updatedAtColumn
    )
      throw new BadRequestException('업무 키와 수정 시점 열을 각각 선택해 주세요.');
    return { keyColumn: body.keyColumn, updatedAtColumn: body.updatedAtColumn };
  }
  async start(
    sourceId: unknown,
    file: AnalysisUpload,
    expected: unknown,
    request: unknown,
    actor: number,
    correctionInput?: unknown,
    expectedEpoch?: number,
  ) {
    try {
      const source = await this.owner(sourceId, actor);
      if (!Number.isSafeInteger(expectedEpoch) || expectedEpoch < 0)
        throw new ForbiddenException('Current actor required.');
      const correction = this.correction(correctionInput);
      const requestId = this.requestId(request);
      if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected))
        throw new BadRequestException('파일 버전을 다시 불러와 주세요.');
      const extension = path.extname(file?.originalname || '').toLowerCase();
      if (!['.csv', '.json', '.parquet'].includes(extension))
        throw new BadRequestException('CSV / JSON / Parquet 파일을 선택해 주세요.');
      const size = file.path ? (await fs.stat(file.path)).size : file.buffer?.length;
      if (!size || size > (Number(process.env.FILE_UPLOAD_MAX_BYTES) || 512 * 1024 * 1024))
        throw new BadRequestException('파일 크기를 확인해 주세요.');
      const inputDigest = await this.worker.uploadDigest(file);
      const payloadDigest = createHash('sha256')
        .update(
          JSON.stringify([
            source.id,
            expected,
            extension,
            inputDigest,
            ...(correction ? [correction] : []),
          ]),
        )
        .digest('hex');
      const prior = await this.repository().findOneBy({ actorId: actor, requestId });
      if (prior) {
        if (prior.sourceId !== source.id || prior.payloadDigest !== payloadDigest)
          throw new ConflictException(
            '같은 요청 ID의 파일 또는 기준 버전이 다릅니다. 기존 작업은 유지했습니다.',
          );
        return this.view(await this.expire(prior));
      }
      if (JSON.parse(decryptConnectionConfig(source.connectionConfig)).fileModel)
        throw new BadRequestException(
          '연결 모델은 고정 스냅샷입니다. 원본 품질을 다시 확인해 새 연결 소스로 만들어 주세요.',
        );
      if (createHash('sha256').update(source.connectionConfig).digest('hex') !== expected)
        throw new ConflictException(
          '파일이 변경되었습니다. 최신 버전을 읽은 뒤 새 요청을 만들어 주세요.',
        );
      await this.cleanupForActor(actor);
      await this.cleanupOrphanAdmissions(actor);
      if ((await this.retainedCount(actor)) >= 3)
        throw new ServiceUnavailableException(
          '보관 중인 갱신 입력이 3개입니다. 기존 작업을 확인하거나 취소한 뒤 다시 시도해 주세요.',
        );
      // Staged inputs are counted in the user's stored bytes, so this must come before the copy.
      await this.files.assertUploadWithinLimits?.(actor, size);
      const id = randomUUID(),
        directory = this.directory(id);
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const staged = path.join(directory, 'source' + extension);
      try {
        await fs.writeFile(
          path.join(directory, 'admission.json'),
          JSON.stringify({
            actorId: actor,
            sourceId: source.id,
            createdAt: Date.now(),
            storageDigest: this.storageDigest(),
          }),
          { mode: 0o600 },
        );
        if (file.path) await fs.copyFile(file.path, staged);
        else await fs.writeFile(staged, file.buffer);
        await fs.chmod(staged, 0o600);
        const job = await serializedViewWrite(this.repository(), () =>
          sourceWriteTransaction(this.db, async manager => {
            await lockSourceActor(manager, actor, expectedEpoch);
            const currentSource = (await lockMetricSources(manager, [source.id])).get(source.id);
            assertSourceOwner(currentSource, actor);
            if (
              currentSource.engine !== 'duckdb' ||
              createHash('sha256').update(currentSource.connectionConfig).digest('hex') !== expected
            )
              throw new ConflictException('파일 소유·기준이 변경됐습니다.');
            const prior = await manager.findOne(FileRefresh, {
              where: { actorId: actor, requestId },
            });
            if (prior) {
              if (prior.payloadDigest !== payloadDigest)
                throw new ConflictException('같은 요청 ID의 내용이 다릅니다.');
              return prior;
            }
            if ((await this.retainedCount(actor, manager)) > 3)
              throw new ServiceUnavailableException(
                '보관 중인 갱신 입력이 3개입니다. 기존 작업을 확인하거나 취소해 주세요.',
              );
            return manager.save(FileRefresh, {
              id,
              actorId: actor,
              actorEpoch: expectedEpoch,
              sourceId: source.id,
              requestId,
              payloadDigest,
              inputDigest,
              expectedRevision: expected,
              storageDigest: this.storageDigest(),
              inputRetained: true,
              originalname: path.basename(file.originalname).slice(0, 256),
              extension,
              correction: correction ? JSON.stringify(correction) : null,
              status: 'queued',
              attempts: 0,
              leaseToken: null,
              leaseUntil: null,
              result: null,
              error: null,
            });
          }),
        );
        if (job.id !== id) await fs.rm(directory, { recursive: true, force: true });
        this.schedule(job.id);
        return this.view(job);
      } catch (failure) {
        // Reconcile first. A committed admission must keep its durable input even if its response failed.
        let winner: FileRefresh;
        try {
          winner = await this.repository().findOneBy({ actorId: actor, requestId });
        } catch {
          throw new ServiceUnavailableException(
            '갱신 접수 결과를 확인하지 못했습니다. 같은 요청 ID로 상태를 확인해 주세요. 파일은 보존했습니다.',
          );
        }
        if (winner?.id !== id) await fs.rm(directory, { recursive: true, force: true });
        if (winner?.payloadDigest === payloadDigest) {
          this.schedule(winner.id);
          return this.view(await this.expire(winner));
        }
        if (winner) throw new ConflictException('같은 요청 ID의 내용이 다릅니다.');
        throw failure;
      }
    } finally {
      if (file?.path) await fs.rm(file.path, { force: true });
    }
  }
  async retry(sourceId: unknown, request: unknown, actor: number, expectedEpoch?: number) {
    await this.get(sourceId, request, actor);
    const job = await this.repository().findOneByOrFail({
      actorId: actor,
      sourceId: this.access.id(sourceId),
      requestId: this.requestId(request),
    });
    if (job.status === 'succeeded' || job.status === 'running') return this.view(job);
    if (job.actorEpoch === null || job.actorEpoch !== expectedEpoch)
      throw new ForbiddenException(
        '갱신을 접수한 인증 기준이 달라졌습니다. 최신 소스를 확인해 새 요청을 만들어 주세요.',
      );
    if (!['queued', 'interrupted', 'failed'].includes(job.status))
      throw new ConflictException('이 작업은 다시 실행할 수 없습니다.');
    if (job.attempts >= 3)
      throw new BadRequestException(
        '같은 입력은 최대 3회 실행합니다. 최신 소스를 확인한 뒤 새 요청을 만들어 주세요.',
      );
    if (job.storageDigest !== this.storageDigest())
      throw new BadRequestException('입력을 보관한 서버에서 같은 작업을 다시 실행해 주세요.');
    const input = this.input(job);
    try {
      if (
        (await this.worker.uploadDigest({ path: input, originalname: job.originalname })) !==
        job.inputDigest
      )
        throw new Error();
    } catch {
      throw new BadRequestException(
        '보관된 입력을 사용할 수 없습니다. 기존 성공 데이터는 유지됩니다. 파일을 다시 선택해 새 요청을 만들어 주세요.',
      );
    }
    const updated = await sourceWriteTransaction(this.db, async manager => {
      await lockSourceActor(manager, actor, expectedEpoch);
      const currentSource = (await lockMetricSources(manager, [job.sourceId])).get(job.sourceId);
      assertSourceOwner(currentSource, actor);
      return manager.update(
        FileRefresh,
        { id: job.id, status: job.status },
        { status: 'queued', error: null },
      );
    });
    if (updated.affected === 1) this.schedule(job.id);
    return this.get(sourceId, request, actor);
  }
  async cancel(sourceId: unknown, request: unknown, actor: number) {
    const view = await this.get(sourceId, request, actor);
    if (view.status === 'succeeded' || view.status === 'cancelled') {
      await this.cleanupInput(view.id);
      return this.get(sourceId, request, actor);
    }
    const cancelled = await this.patch(
      { id: view.id, actorId: actor, status: In(['queued', 'running', 'failed', 'interrupted']) },
      { status: 'cancelled', leaseToken: null, leaseUntil: null, error: null },
    );
    if (cancelled.affected === 1) this.cancellations.get(view.id)?.abort();
    await this.cleanupInput(view.id);
    return this.get(sourceId, request, actor);
  }
  private schedule(id: string) {
    if (this.closing) return;
    if (this.tasks.has(id)) {
      this.rerun.add(id);
      return;
    }
    const promise = new Promise<void>(resolve => setImmediate(resolve))
      .then(() => this.run(id))
      .catch(() => undefined)
      .finally(() => {
        this.tasks.delete(id);
        if (this.rerun.delete(id) && !this.closing) this.schedule(id);
      });
    this.tasks.set(id, promise);
  }
  private error(failure: any) {
    if (Object.prototype.hasOwnProperty.call(FILE_CORRECTION_MESSAGES, failure?.code))
      return { code: failure.code, message: FILE_CORRECTION_MESSAGES[failure.code] };
    const body = typeof failure?.getResponse === 'function' ? failure.getResponse() : undefined;
    if (body?.code === 'FILE_SCHEMA_CHANGED')
      return { code: body.code, message: body.message, changes: body.changes };
    const status = typeof failure?.getStatus === 'function' ? failure.getStatus() : 500;
    return {
      code: status === 409 ? 'FILE_REFRESH_CONFLICT' : 'FILE_REFRESH_FAILED',
      message:
        status === 409
          ? '기준 파일 또는 작업 상태가 변경되어 활성화하지 않았습니다. 최신 버전을 확인해 주세요.'
          : '파일 갱신에 실패했습니다. 마지막 성공 데이터를 유지했습니다. 입력 형식과 서버 상태를 확인한 뒤 같은 작업을 다시 실행할 수 있습니다.',
    };
  }
  private async run(id: string) {
    const job = await this.repository().findOneByOrFail({ id });
    if (job.status !== 'queued' || this.closing || job.storageDigest !== this.storageDigest())
      return;
    await this.owner(job.sourceId, job.actorId);
    const token = randomUUID();
    const claimed = await this.patch(
      { id, status: 'queued', attempts: job.attempts },
      {
        status: 'running',
        attempts: job.attempts + 1,
        leaseToken: token,
        leaseUntil: new Date(Date.now() + LEASE_MS).toISOString(),
      },
    );
    if (claimed.affected !== 1) return;
    const cancellation = new AbortController();
    this.cancellations.set(id, cancellation);
    const heartbeat = setInterval(() => {
      void this.patch(
        {
          id,
          status: 'running',
          leaseToken: token,
          leaseUntil: MoreThan(new Date().toISOString()),
        },
        { leaseUntil: new Date(Date.now() + LEASE_MS).toISOString() },
      )
        .then(result => {
          if (result.affected !== 1) cancellation.abort();
        })
        .catch(() => undefined);
    }, 5000);
    heartbeat.unref();
    this.heartbeats.add(heartbeat);
    const attempt = path.join(this.directory(id), 'attempt-' + token + job.extension);
    try {
      if (
        (await this.worker.uploadDigest({
          path: this.input(job),
          originalname: job.originalname,
        })) !== job.inputDigest
      )
        throw new BadRequestException('input checksum');
      await fs.copyFile(this.input(job), attempt);
      await this.worker.withCancellation(cancellation.signal, () =>
        this.files.replaceFile(
          job.sourceId,
          { path: attempt, originalname: job.originalname },
          job.expectedRevision,
          job.actorId,
          async activate =>
            serializedViewWrite(this.repository(), () =>
              sourceWriteTransaction(this.db, async manager => {
                await lockSourceActor(manager, job.actorId, job.actorEpoch);
                assertSourceOwner(
                  (await lockMetricSources(manager, [job.sourceId])).get(job.sourceId),
                  job.actorId,
                );
                const current = await manager.findOne(FileRefresh, {
                  where: { id, status: 'running', leaseToken: token, actorEpoch: job.actorEpoch },
                  ...(this.db.options.type !== 'sqlite'
                    ? { lock: { mode: 'pessimistic_write' as const } }
                    : {}),
                });
                if (!current?.leaseUntil || Date.parse(current.leaseUntil) <= Date.now())
                  throw new ConflictException('작업 실행권을 다시 확인해 주세요.');
                const source = await manager.findOne(Database, {
                  where: { id: job.sourceId, ownerId: job.actorId, engine: 'duckdb' },
                });
                if (!source) throw new NotFoundException('source');
                const result = await activate(manager);
                const done = await manager.update(
                  FileRefresh,
                  {
                    id,
                    status: 'running',
                    leaseToken: token,
                    leaseUntil: MoreThan(new Date().toISOString()),
                  },
                  {
                    status: 'succeeded',
                    result: JSON.stringify(
                      result.data
                        ? { ...result.data, ...(result.unchanged ? { unchanged: true } : {}) }
                        : result,
                    ),
                    leaseToken: null,
                    leaseUntil: null,
                    error: null,
                  },
                );
                if (done.affected !== 1)
                  throw new ConflictException('작업 실행권이 변경되었습니다.');
                return result;
              }),
            ),
          job.correction ? JSON.parse(job.correction) : undefined,
          job.actorEpoch,
        ),
      );
      await this.cleanupInput(id);
    } catch (failure) {
      await this.patch(
        { id, status: 'running', leaseToken: token },
        {
          status: 'failed',
          error: JSON.stringify(this.error(failure)),
          leaseToken: null,
          leaseUntil: null,
        },
      );
    } finally {
      clearInterval(heartbeat);
      this.heartbeats.delete(heartbeat);
      try {
        await fs.rm(attempt, { force: true });
      } finally {
        this.cancellations.delete(id);
        await this.cleanupInput(id);
      }
    }
  }
  async onModuleDestroy() {
    this.closing = true;
    for (const timer of this.heartbeats) clearInterval(timer);
    this.heartbeats.clear();
    // Do not erase another process's lease or wait for a stopped worker. Expired work stays explicit.
  }
}
