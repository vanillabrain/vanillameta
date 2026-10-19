import { lockMetricReferences } from '../metric/metric-write-lock';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager, MoreThan, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { ConnectionService } from '../connection/connection.service';
import { BiService } from './bi.service';
import { BiExploreService } from './bi-explore.service';
import { EXPORT_LIMITS, EXPORT_MIME } from './bi-explore-export';
import { ExportJob, ExportPart } from './entities/export-job.entity';
const TTL = 24 * 60 * 60 * 1000,
  LEASE = 5 * 60 * 1000;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const positive = (x: unknown): x is number => Number.isSafeInteger(x) && Number(x) > 0;
function exact(x: any, keys: string[]) {
  if (
    !x ||
    typeof x !== 'object' ||
    Array.isArray(x) ||
    Object.keys(x).length !== keys.length ||
    Object.keys(x).some(k => !keys.includes(k))
  )
    throw new BadRequestException('작업 요청 항목을 확인해 주세요.');
}
function canonical(x: any, depth = 0): any {
  if (depth > 16) throw new BadRequestException('조건 중첩이 너무 깊습니다.');
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return x;
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (Array.isArray(x)) return x.map(v => canonical(v, depth + 1));
  if (x && Object.getPrototypeOf(x) === Object.prototype)
    return Object.fromEntries(
      Object.keys(x)
        .sort()
        .map(k => [k, canonical(x[k], depth + 1)]),
    );
  throw new BadRequestException('JSON 조건을 확인해 주세요.');
}
/** UTF16 boundaries preserve Unicode; each TEXT row is <=36KiB UTF8. */
export function exportParts(csv: string) {
  const rows: string[] = [];
  let start = 0;
  while (start < csv.length) {
    let end = Math.min(start + 12000, csv.length);
    if (end < csv.length && /[\uD800-\uDBFF]/.test(csv[end - 1])) end--;
    rows.push(csv.slice(start, end));
    start = end;
  }
  return rows;
}
@Injectable()
export class ExportJobsService {
  private readonly logger = new Logger(ExportJobsService.name);
  private readonly tasks = new Set<Promise<unknown>>();
  async onModuleDestroy() {
    await Promise.allSettled(Array.from(this.tasks));
  }
  constructor(
    private readonly db: DataSource,
    private readonly bi: BiService,
    private readonly explore: BiExploreService,
    private readonly connection: ConnectionService,
  ) {}
  private async tx<T>(run: (m: EntityManager) => Promise<T>) {
    try {
      return await (['mysql', 'mariadb'].includes(this.db.options.type)
        ? metadataTransaction(this.db, 'READ COMMITTED', run)
        : metadataTransaction(this.db, run));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (/UNIQUE|PRIMARY KEY/i.test(error.driverError?.message ?? '') ||
          [
            'SQLITE_BUSY',
            'SQLITE_LOCKED',
            'ER_DUP_ENTRY',
            'ER_LOCK_DEADLOCK',
            'ER_LOCK_WAIT_TIMEOUT',
          ].includes(error.driverError?.code))
      )
        throw new ConflictException('파일 작업 저장이 경합 중입니다. 같은 요청으로 확인해 주세요.');
      throw error;
    }
  }
  private id(id: unknown) {
    if (!positive(id)) throw new BadRequestException('파일 작업 번호를 확인해 주세요.');
    return id;
  }
  private async scope(actor: number, m: EntityManager, lock = false, expectedEpoch?: number) {
    this.id(actor);
    const locking =
      lock && ['mysql', 'mariadb'].includes(m.connection.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
    const user = await m.findOne(User, {
      where: { id: actor },
      select: { id: true, active: true, authVersion: true },
      ...locking,
    });
    const member = await m.findOne(EnterpriseMembership, { where: { userId: actor }, ...locking });
    if (!user?.active || !member)
      throw new ForbiddenException('현재 조직의 활성 본인 계정이 필요합니다.');
    if (expectedEpoch !== undefined && user.authVersion !== expectedEpoch)
      throw new UnauthorizedException('로그인 상태를 다시 확인해 주세요.');
    return { org: member.organizationId, epoch: user.authVersion };
  }
  private async source(sourceId: number, actor: number, m: EntityManager) {
    await this.bi.assertSourceAction(sourceId, actor, 'export');
    const source = await m.findOne(Database, {
      where: { id: sourceId },
      select: { id: true, ownerId: true },
    });
    if (!source || !positive(source.ownerId))
      throw new ForbiddenException('현재 소스 내보내기 권한이 필요합니다.');
    return source.ownerId;
  }
  private input(body: any) {
    exact(body, ['requestId', 'payload', 'measureVersions']);
    if (
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.requestId)
    )
      throw new BadRequestException('작업 요청 번호를 확인해 주세요.');
    const frozen = canonical(body),
      json = JSON.stringify(frozen);
    if (Buffer.byteLength(json) > 49152)
      throw new BadRequestException('작업 조건은48KiB 이하여야 합니다.');
    exact(frozen.payload, ['mode', 'query']);
    const q = frozen.payload.query;
    if (
      !['explore', 'pivot'].includes(frozen.payload.mode) ||
      !q ||
      Array.isArray(q) ||
      typeof q !== 'object' ||
      !positive(q.sourceId) ||
      typeof q.sourceRevision !== 'string' ||
      !q.sourceRevision ||
      q.sourceRevision.length > 256 ||
      q.includeRows === true ||
      !Array.isArray(q.measureIds) ||
      q.measureIds.length < 1 ||
      q.measureIds.length > 6 ||
      q.measureIds.some(id => !positive(id)) ||
      new Set(q.measureIds).size !== q.measureIds.length
    )
      throw new BadRequestException('집계 조건·소스·선택 지표를 확인해 주세요.');
    this.explore.validateExportRequest(frozen.payload);
    exact(frozen.measureVersions, q.measureIds.map(String));
    if (Object.values(frozen.measureVersions).some(v => !positive(v)))
      throw new BadRequestException('지표 버전을 확인해 주세요.');
    if (
      q.expectedMeasureVersions !== undefined &&
      (Object.keys(q.expectedMeasureVersions).length !== q.measureIds.length ||
        q.measureIds.some(id => q.expectedMeasureVersions[id] !== frozen.measureVersions[id]))
    )
      throw new BadRequestException('중첩 지표 버전과 작업의 고정 버전이 다릅니다.');
    return { value: frozen, json, digest: hash(json) };
  }
  private async lockReferences(m: EntityManager, sourceId: number, payload: any, versions: any) {
    if (payload?.query?.sourceId !== sourceId)
      throw new ConflictException('파일 작업 소스 기준이 다릅니다.');
    const rows = await lockMetricReferences(m, sourceId, payload.query.measureIds);
    for (const [id, row] of rows) {
      let definition;
      try {
        definition = JSON.parse(row.definition);
      } catch {}
      if (!definition || definition.definitionVersion !== versions[String(id)])
        throw new ConflictException('지표 기준이 변경됐습니다. 새 기준으로 작업을 접수해 주세요.');
    }
  }
  private async basis(
    sourceId: number,
    payload: any,
    versions: any,
    actor: number,
    m: EntityManager,
  ) {
    const ownerId = await this.source(sourceId, actor, m);
    const revision = await this.connection.duckDBVersion(sourceId);
    if (revision !== payload.query.sourceRevision)
      throw new ConflictException('소스 기준이 변경됐습니다. 새 기준으로 작업을 접수해 주세요.');
    const metrics = await this.bi.metrics(sourceId, actor);
    const selected = payload.query.measureIds.map((id: number) => {
      const metric = metrics.find(row => row.id === id);
      if (!metric || metric.definitionVersion !== versions[String(id)])
        throw new ConflictException('지표 기준이 변경됐습니다. 새 기준으로 작업을 접수해 주세요.');
      return {
        id,
        version: metric.definitionVersion,
        digest: hash(JSON.stringify(canonical(metric.definition))),
      };
    });
    return JSON.stringify(canonical({ ownerId, sourceRevision: revision, metrics: selected }));
  }
  private dto(job: ExportJob) {
    const payload = JSON.parse(job.requestJson).payload,
      basis = JSON.parse(job.basisJson);
    const status =
      job.expiresAt.getTime() <= Date.now()
        ? 'expired'
        : job.status === 'running' && job.leaseUntil && job.leaseUntil.getTime() <= Date.now()
        ? 'interrupted'
        : job.status;
    return {
      id: job.id,
      requestId: job.requestId,
      sourceId: job.sourceId,
      sourceRevision: basis.sourceRevision,
      measureVersions: Object.fromEntries(basis.metrics.map(row => [row.id, row.version])),
      payload,
      status,
      version: job.version,
      createdAt: job.createdAt.toISOString(),
      expiresAt: job.expiresAt.toISOString(),
      rowCount: job.rowCount,
      bytes: job.bytes,
      filename: job.filename,
      errorCode: job.errorCode,
    };
  }
  private async owned(
    id: number,
    actor: number,
    m: EntityManager,
    lock = false,
    expectedEpoch?: number,
  ) {
    const scope = await this.scope(actor, m, lock, expectedEpoch);
    const job = await m.findOne(ExportJob, {
      where: { id: this.id(id), ownerId: actor, organizationId: scope.org },
      ...(lock && ['mysql', 'mariadb'].includes(m.connection.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!job) throw new ForbiddenException('본인 조직의 파일 작업만 확인할 수 있습니다.');
    if ((await this.source(job.sourceId, actor, m)) !== job.sourceOwnerId)
      throw new ForbiddenException('원 소스 소유권이 변경되었습니다.');
    return { job, scope };
  }
  private live(job: ExportJob) {
    if (job.expiresAt.getTime() <= Date.now())
      throw new GoneException('파일 작업이 만료되었습니다.');
  }
  private version(body: any) {
    exact(body, ['expectedVersion']);
    if (!positive(body.expectedVersion) || body.expectedVersion >= 2147483647)
      throw new BadRequestException('작업 버전을 확인해 주세요.');
    return body.expectedVersion as number;
  }
  private async audit(m: EntityManager, job: ExportJob, action: string) {
    await m.insert(EnterpriseAuditEvent, {
      organizationId: job.organizationId,
      actorId: job.ownerId,
      subjectId: job.ownerId,
      resourceId: job.id,
      version: job.version,
      action: 'export.' + action,
    });
  }
  async create(body: any, actor: number, expectedEpoch?: number) {
    const input = this.input(body);
    return this.tx(async m => {
      const scope = await this.scope(actor, m, true, expectedEpoch);
      const q = input.value.payload.query;
      const ownerId = await this.source(q.sourceId, actor, m);
      const prior = await m.findOneBy(ExportJob, {
        ownerId: actor,
        requestId: input.value.requestId,
      });
      if (prior) {
        if (
          prior.organizationId !== scope.org ||
          prior.digest !== input.digest ||
          prior.sourceOwnerId !== ownerId
        )
          throw new ConflictException('같은 요청 번호의 조직·조건이 다릅니다.');
        return this.dto(prior);
      }
      await this.lockReferences(m, q.sourceId, input.value.payload, input.value.measureVersions);
      const basisJson = await this.basis(
        q.sourceId,
        input.value.payload,
        input.value.measureVersions,
        actor,
        m,
      );
      if (
        (await m.count(ExportJob, {
          where: { ownerId: actor, expiresAt: MoreThan(new Date()) },
        })) >= 100
      )
        throw new ConflictException('미만료 파일 작업 한도100개입니다.');
      const job = await m.save(ExportJob, {
        ownerId: actor,
        organizationId: scope.org,
        sourceId: q.sourceId,
        sourceOwnerId: JSON.parse(basisJson).ownerId,
        requestId: input.value.requestId,
        digest: input.digest,
        requestJson: input.json,
        basisJson,
        status: 'queued',
        version: 1,
        expiresAt: new Date(Date.now() + TTL),
        attemptToken: null,
        leaseUntil: null,
        filename: null,
        hash: null,
        errorCode: null,
        rowCount: 0,
        bytes: 0,
        partCount: 0,
      });
      await this.audit(m, job, 'queued');
      return this.dto(job);
    });
  }
  async get(id: number, actor: number, expectedEpoch?: number) {
    return serializeMetadataWork(this.db, async () =>
      this.dto((await this.owned(id, actor, this.db.manager, false, expectedEpoch)).job),
    );
  }
  async list(actor: number, before?: number, expectedEpoch?: number) {
    if (before !== undefined) this.id(before);
    return serializeMetadataWork(this.db, async () => {
      const scope = await this.scope(actor, this.db.manager, false, expectedEpoch);
      const query = this.db
        .getRepository(ExportJob)
        .createQueryBuilder('job')
        .where('job.ownerId = :actor AND job.organizationId = :org', { actor, org: scope.org });
      if (before !== undefined) query.andWhere('job.id < :before', { before });
      const rows = await query.orderBy('job.id', 'DESC').limit(21).getMany();
      const entries = [];
      for (const row of rows.slice(0, 20)) {
        try {
          entries.push(
            this.dto((await this.owned(row.id, actor, this.db.manager, false, expectedEpoch)).job),
          );
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      }
      return { entries, nextBeforeId: rows.length > 20 ? rows[19].id : null };
    });
  }
  async run(id: number, body: any, actor: number, background = false, expectedEpoch?: number) {
    const expected = this.version(body);
    const claim = await this.tx(async m => {
      const { job, scope } = await this.owned(id, actor, m, true, expectedEpoch);
      this.live(job);
      if (expected > job.version) throw new ConflictException('작업 버전을 다시 확인해 주세요.');
      if (
        expected < job.version ||
        ['ready', 'cancelled'].includes(job.status) ||
        (job.status === 'running' && job.leaseUntil && job.leaseUntil.getTime() > Date.now())
      )
        return { result: this.dto(job) };
      const request = this.input(JSON.parse(job.requestJson)).value;
      await this.lockReferences(m, job.sourceId, request.payload, request.measureVersions);
      if (
        (await this.basis(job.sourceId, request.payload, request.measureVersions, actor, m)) !==
        job.basisJson
      )
        throw new ConflictException('고정 기준이 변경됐습니다.');
      const token = randomUUID(),
        version = job.version + 1;
      const update = await m.update(
        ExportJob,
        { id: job.id, version: job.version },
        {
          status: 'running',
          version,
          attemptToken: token,
          leaseUntil: new Date(Date.now() + LEASE),
          errorCode: null,
        },
      );
      if (update.affected !== 1) throw new ConflictException('다른 실행이 먼저 시작되었습니다.');
      Object.assign(job, {
        status: 'running',
        version,
        attemptToken: token,
        leaseUntil: new Date(Date.now() + LEASE),
      });
      await this.audit(m, job, 'running');
      return { job, scope, token };
    });
    if ('result' in claim) return claim.result;
    const { job, scope, token } = claim;
    const execute = async () => {
      try {
        const request = JSON.parse(job.requestJson);
        const before = await serializeMetadataWork(this.db, async () => {
          const { job: current, scope: now } = await this.owned(
            id,
            actor,
            this.db.manager,
            false,
            expectedEpoch,
          );
          if (
            current.status !== 'running' ||
            current.attemptToken !== token ||
            !current.leaseUntil ||
            current.leaseUntil.getTime() <= Date.now()
          )
            return { stopped: this.dto(current) };
          if (now.epoch !== scope.epoch)
            throw new ForbiddenException('실행 중 인증 상태가 변경됐습니다.');
          return {
            basis: await this.basis(
              job.sourceId,
              request.payload,
              request.measureVersions,
              actor,
              this.db.manager,
            ),
          };
        });
        if ('stopped' in before) return before.stopped;
        if (before.basis !== job.basisJson)
          throw new ConflictException('고정 기준이 변경됐습니다.');
        // Aggregate SQL intentionally runs outside the metadata transaction and SQLite queue.
        const output = await this.explore.exportCsv(request.payload, actor);
        return await this.tx(async m => {
          await this.owned(id, actor, m, true, expectedEpoch);
          await this.lockReferences(m, job.sourceId, request.payload, request.measureVersions);
          // UC054: hold the shared Source/Metric fences through publication, then reread access.
          const { job: current, scope: now } = await this.owned(id, actor, m, true, expectedEpoch);
          if (current.status !== 'running' || current.attemptToken !== token)
            return this.dto(current);
          if (!current.leaseUntil || current.leaseUntil.getTime() <= Date.now())
            return this.dto(current);
          this.live(current);
          if (now.epoch !== scope.epoch)
            throw new ForbiddenException('실행 중 인증 상태가 변경됐습니다.');
          if (
            (await this.basis(job.sourceId, request.payload, request.measureVersions, actor, m)) !==
            job.basisJson
          )
            throw new ConflictException('고정 기준이 변경됐습니다.');
          if (
            typeof output.csv !== 'string' ||
            output.sourceRevision !== request.payload.query.sourceRevision ||
            output.mimeType !== EXPORT_MIME ||
            !/^[a-zA-Z0-9_-]+\.csv$/.test(output.filename) ||
            !Number.isInteger(output.rowCount) ||
            output.rowCount < 0 ||
            output.rowCount > EXPORT_LIMITS.rows ||
            output.bytes !== Buffer.byteLength(output.csv) ||
            output.bytes > EXPORT_LIMITS.bytes
          )
            throw new BadRequestException('집계 파일 결과를 확인할 수 없습니다.');
          const parts = exportParts(output.csv);
          if (parts.length > 200) throw new BadRequestException('파일 부분 한도 오류');
          await m.delete(ExportPart, { jobId: id });
          if (parts.length)
            await m.insert(
              ExportPart,
              parts.map((data, part) => ({ jobId: id, part, data })),
            );
          Object.assign(current, {
            status: 'ready',
            version: current.version + 1,
            filename: output.filename,
            hash: hash(output.csv),
            rowCount: output.rowCount,
            bytes: output.bytes,
            partCount: parts.length,
            attemptToken: null,
            leaseUntil: null,
            errorCode: null,
          });
          const update = await m.update(
            ExportJob,
            {
              id,
              version: job.version,
              attemptToken: token,
              status: 'running',
              leaseUntil: MoreThan(new Date(Date.now())),
              expiresAt: MoreThan(new Date(Date.now())),
            },
            {
              status: current.status,
              version: current.version,
              filename: current.filename,
              hash: current.hash,
              rowCount: current.rowCount,
              bytes: current.bytes,
              partCount: current.partCount,
              attemptToken: null,
              leaseUntil: null,
              errorCode: null,
            },
          );
          if (update.affected !== 1) throw new ConflictException('실행 상태가 변경됐습니다.');
          await this.audit(m, current, 'ready');
          return this.dto(current);
        });
      } catch (error) {
        await this.tx(async m => {
          const current = await m.findOneBy(ExportJob, {
            id,
            ownerId: actor,
            status: 'running',
            attemptToken: token,
          });
          if (!current || !current.leaseUntil || current.leaseUntil.getTime() <= Date.now()) return;
          const version = current.version + 1,
            errorCode =
              error instanceof ConflictException
                ? 'BASIS_CHANGED'
                : error instanceof ForbiddenException || error instanceof UnauthorizedException
                ? 'ACCESS_REVOKED'
                : 'QUERY_FAILED';
          const changed = await m.update(
            ExportJob,
            { id, version: current.version, attemptToken: token, status: 'running' },
            { status: 'failed', version, errorCode, attemptToken: null, leaseUntil: null },
          );
          if (changed.affected !== 1) return;
          await m.delete(ExportPart, { jobId: id });
          await this.audit(m, { ...current, version }, 'failed');
        });
        return this.get(id, actor, expectedEpoch);
      }
    };
    if (!background) return execute();
    const task = execute();
    this.tasks.add(task);
    void task.then(
      () => this.tasks.delete(task),
      error => {
        this.tasks.delete(task);
        this.logger.error({
          event: 'export_background_failed',
          jobId: id,
          attempt: token,
          classification:
            error instanceof QueryFailedError
              ? 'STORAGE_FAILURE'
              : error instanceof ConflictException
              ? 'STATE_RACE'
              : error instanceof ForbiddenException || error instanceof UnauthorizedException
              ? 'ACCESS_REVOKED'
              : 'UNEXPECTED',
        });
      },
    );
    return this.dto(job);
  }
  async cancel(id: number, body: any, actor: number, expectedEpoch?: number) {
    const expected = this.version(body);
    return this.tx(async m => {
      const { job } = await this.owned(id, actor, m, true, expectedEpoch);
      if (expected > job.version) throw new ConflictException('작업 버전을 다시 확인해 주세요.');
      if (job.status === 'cancelled') return this.dto(job);
      if (expected !== job.version) throw new ConflictException('작업 상태를 다시 확인해 주세요.');
      await m.delete(ExportPart, { jobId: id });
      const version = job.version + 1;
      const changed = await m.update(
        ExportJob,
        { id, version: job.version },
        {
          status: 'cancelled',
          version,
          attemptToken: null,
          leaseUntil: null,
          filename: null,
          hash: null,
          rowCount: 0,
          bytes: 0,
          partCount: 0,
          errorCode: null,
        },
      );
      if (changed.affected !== 1) throw new ConflictException('작업 상태가 변경됐습니다.');
      Object.assign(job, {
        status: 'cancelled',
        version,
        filename: null,
        rowCount: 0,
        bytes: 0,
        errorCode: null,
      });
      await this.audit(m, job, 'cancelled');
      return this.dto(job);
    });
  }
  async file(id: number, actor: number, expectedEpoch?: number) {
    return serializeMetadataWork(this.db, async () => {
      const { job, scope } = await this.owned(id, actor, this.db.manager, false, expectedEpoch);
      this.live(job);
      if (job.status !== 'ready') throw new ConflictException('완료한 파일만 받을 수 있습니다.');
      const parts = await this.db.manager.find(ExportPart, {
        where: { jobId: id },
        order: { part: 'ASC' },
        take: 201,
      });
      if (
        parts.length !== job.partCount ||
        parts.length > 200 ||
        parts.some(
          (row, index) =>
            row.part !== index ||
            typeof row.data !== 'string' ||
            Buffer.byteLength(row.data) > 49152,
        )
      )
        throw new ConflictException('저장 파일 부분을 확인할 수 없습니다.');
      const csv = parts.map(row => row.data).join('');
      if (
        Buffer.byteLength(csv) !== job.bytes ||
        job.bytes > EXPORT_LIMITS.bytes ||
        hash(csv) !== job.hash
      )
        throw new ConflictException('저장 파일 무결성을 확인할 수 없습니다.');
      const latest = await this.owned(id, actor, this.db.manager, false, expectedEpoch);
      this.live(latest.job);
      if (
        latest.scope.epoch !== scope.epoch ||
        latest.job.version !== job.version ||
        latest.job.status !== 'ready'
      )
        throw new ConflictException('파일 전달 상태가 변경됐습니다.');
      return {
        sourceRevision: JSON.parse(job.basisJson).sourceRevision,
        filename: job.filename,
        mimeType: EXPORT_MIME,
        csv,
        rowCount: job.rowCount,
        bytes: job.bytes,
        sha256: job.hash,
      };
    });
  }
}
