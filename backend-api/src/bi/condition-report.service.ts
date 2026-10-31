import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { randomUUID } from 'crypto';
import { compareExactNumeric } from './bi-explore-sort';
import { GovernanceService } from './governance.service';
import {
  ConditionReport,
  ConditionReportOccurrence,
  ReportOutcome,
} from './condition-report.entity';
import { governedKeys } from './governed-query';
import { serializedViewWrite } from '../dashboard/view-write-queue';
import { User } from '../user/entities/user.entity';
import { Database } from '../database/entities/database.entity';
import { studioDigest } from '../dashboard-studio/studio-legacy';
import { decryptConnectionConfig, encryptConnectionConfig } from '../utils/crypto.util';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const now = () => new Date().toISOString();
const unavailable = () => new ForbiddenException('이 예약 보고에 접근할 수 없습니다.');
@Injectable()
export class ConditionReportService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  constructor(private readonly db: DataSource, private readonly governance: GovernanceService) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      void this.runDue().catch(() => undefined);
    }, 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private scope(org: number, dashboard: number, actor: number) {
    if (![org, dashboard, actor].every(n => Number.isSafeInteger(n) && n > 0)) throw unavailable();
  }
  private async catalog(
    job: Pick<ConditionReport, 'organizationId' | 'dashboardId' | 'actorId' | 'viewRevision'>,
  ) {
    const c = await this.governance.catalog(job.organizationId, job.dashboardId, job.actorId);
    if (!c.capabilities.export) throw unavailable();
    if (c.viewRevision !== job.viewRevision)
      throw new ConflictException('접근 범위가 바뀌었습니다. 새 예약으로 확인해 주세요.');
    return c;
  }
  private async owned(id: string, org: number, dashboard: number, actor: number) {
    this.scope(org, dashboard, actor);
    if (!UUID.test(id)) throw unavailable();
    const job = await this.db.manager.findOneBy(ConditionReport, {
      id,
      organizationId: org,
      dashboardId: dashboard,
      actorId: actor,
    });
    if (!job) throw unavailable();
    return job;
  }
  async create(org: number, dashboard: number, body: any, actor: number) {
    this.scope(org, dashboard, actor);
    governedKeys(body, [
      'requestId',
      'viewRevision',
      'blockId',
      'operator',
      'threshold',
      'intervalSeconds',
    ]);
    if (
      !UUID.test(body.requestId) ||
      typeof body.blockId !== 'string' ||
      !['gt', 'lt'].includes(body.operator) ||
      typeof body.threshold !== 'string' ||
      !/^-?\d{1,30}(?:\.\d{1,12})?$/.test(body.threshold) ||
      !Number.isInteger(body.intervalSeconds) ||
      body.intervalSeconds < 60 ||
      body.intervalSeconds > 86400
    )
      throw new BadRequestException('숫자 지표·유한 임계값·60초~24시간 주기를 확인해 주세요.');
    const c = await this.governance.catalog(org, dashboard, actor);
    if (!c.capabilities.export) throw unavailable();
    if (c.viewRevision !== body.viewRevision)
      throw new ConflictException('접근 범위를 다시 확인해 주세요.');
    if (!c.blocks.some(b => b.id === body.blockId && b.kind === 'BOARD_NUMERIC'))
      throw new BadRequestException('허용된 숫자 지표만 예약할 수 있습니다.');
    const digest = studioDigest({ actor, org, dashboard, ...body });
    return serializedViewWrite(this.db.getRepository(Database), () =>
      this.db.transaction(async manager => {
        if (this.db.options.type !== 'sqlite') {
          if (
            !(await manager.findOne(User, {
              where: { id: actor },
              lock: { mode: 'pessimistic_write' },
            }))
          )
            throw unavailable();
        }
        const prior = await manager.findOneBy(ConditionReport, { id: body.requestId });
        if (prior) {
          if (prior.actorId !== actor || prior.payloadDigest !== digest)
            throw new ConflictException('같은 예약 요청을 변경할 수 없습니다.');
          return { id: prior.id, active: prior.active, version: prior.version, replayed: true };
        }
        if (
          (await manager.count(ConditionReport, { where: { actorId: actor, active: true } })) >= 10
        )
          throw new BadRequestException('본인의 활성 예약은 최대10개입니다.');
        await this.catalog({
          actorId: actor,
          organizationId: org,
          dashboardId: dashboard,
          viewRevision: c.viewRevision,
        });
        const job = await manager.save(ConditionReport, {
          id: body.requestId,
          actorId: actor,
          organizationId: org,
          dashboardId: dashboard,
          blockId: body.blockId,
          viewRevision: c.viewRevision,
          payloadDigest: digest,
          operator: body.operator,
          threshold: body.threshold,
          intervalSeconds: body.intervalSeconds,
          nextAt: now(),
          active: true,
          version: 1,
          leaseToken: null,
          leaseUntil: null,
        });
        return { id: job.id, active: true, version: 1, replayed: false };
      }),
    );
  }
  async list(org: number, dashboard: number, actor: number) {
    this.scope(org, dashboard, actor);
    const jobs = await this.db.manager.find(ConditionReport, {
      where: { actorId: actor, organizationId: org, dashboardId: dashboard },
      order: { active: 'DESC', createdAt: 'DESC' },
      take: 20,
    });
    const output = [];
    for (const job of jobs) {
      const base = {
        id: job.id,
        active: job.active,
        version: job.version,
        nextAt: job.nextAt,
        intervalSeconds: job.intervalSeconds,
      };
      try {
        const c = await this.catalog(job);
        const occurrences = await this.db.manager.find(ConditionReportOccurrence, {
          where: { reportId: job.id },
          order: { scheduledAt: 'DESC' },
          take: 5,
        });
        const records = occurrences.map(row => ({
          scheduledAt: row.scheduledAt,
          outcome: row.outcome,
          ...(row.result ? { result: JSON.parse(decryptConnectionConfig(row.result)) } : {}),
        }));
        output.push({
          ...base,
          viewRevision: job.viewRevision,
          blockId: job.blockId,
          title: c.blocks.find(b => b.id === job.blockId)?.title,
          operator: job.operator,
          threshold: job.threshold,
          restricted: false,
          records,
        });
      } catch {
        output.push({ ...base, viewRevision: job.viewRevision, restricted: true, records: [] });
      }
    }
    // One final authorization after ALL history reads, before exposing any buffered payload.
    let revision: string | null = null;
    try {
      const c = await this.governance.catalog(org, dashboard, actor);
      if (c.capabilities.export) revision = c.viewRevision;
    } catch {}
    return output.map(row => {
      const { viewRevision, ...value } = row;
      return revision === viewRevision
        ? value
        : {
            id: row.id,
            active: row.active,
            version: row.version,
            nextAt: row.nextAt,
            intervalSeconds: row.intervalSeconds,
            restricted: true,
            records: [],
          };
    });
  }
  async stop(org: number, dashboard: number, id: string, body: any, actor: number) {
    governedKeys(body, ['expectedVersion']);
    const job = await this.owned(id, org, dashboard, actor);
    if (body.expectedVersion !== job.version)
      throw new ConflictException('예약 상태를 다시 확인해 주세요.');
    const changed = await serializedViewWrite(this.db.getRepository(Database), () =>
      this.db.manager.update(
        ConditionReport,
        { id: job.id, actorId: actor, version: job.version },
        { active: false, version: job.version + 1, leaseToken: null, leaseUntil: null },
      ),
    );
    if (changed.affected !== 1) throw new ConflictException('예약 상태가 바뀌었습니다.');
    return { id, active: false, version: job.version + 1 };
  }
  async evaluate(org: number, dashboard: number, id: string, body: any, actor: number) {
    governedKeys(body, []);
    const job = await this.owned(id, org, dashboard, actor);
    await this.process(job.id);
    return { accepted: true };
  }
  async runDue() {
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.db.manager.find(ConditionReport, {
        where: { active: true, nextAt: LessThanOrEqual(now()) },
        order: { nextAt: 'ASC' },
        take: 20,
      });
      for (const j of jobs) await this.process(j.id);
    } finally {
      this.running = false;
    }
  }
  private async process(id: string) {
    const job = await this.db.manager.findOneBy(ConditionReport, { id });
    const at = now();
    if (!job?.active || job.nextAt > at || (job.leaseUntil && job.leaseUntil > at)) return;
    const lease = randomUUID(),
      until = new Date(Date.now() + 120000).toISOString();
    const claimed = await serializedViewWrite(this.db.getRepository(Database), () =>
      this.db.manager
        .createQueryBuilder()
        .update(ConditionReport)
        .set({ leaseToken: lease, leaseUntil: until })
        .where('id = :id AND active = :active AND version = :version AND nextAt = :due', {
          id,
          active: true,
          version: job.version,
          due: job.nextAt,
        })
        .andWhere('(leaseUntil IS NULL OR leaseUntil <= :at)', { at })
        .execute(),
    );
    if (claimed.affected !== 1) return;
    let outcome: ReportOutcome = 'failed',
      result: string | null = null;
    try {
      await this.catalog(job);
      const query = await this.governance.query(
        job.organizationId,
        job.dashboardId,
        { viewRevision: job.viewRevision, blockIds: [job.blockId] },
        job.actorId,
      );
      const block = (query as any).blocks?.[0],
        raw = block?.datas?.[0]?.value;
      if (
        block?.id !== job.blockId ||
        block.kind !== 'BOARD_NUMERIC' ||
        block.datas.length !== 1 ||
        !['number', 'string'].includes(typeof raw) ||
        (typeof raw === 'string' && !raw.trim()) ||
        !Number.isFinite(Number(raw))
      )
        throw new BadRequestException('정확한 숫자 집계를 확인하지 못했습니다.');
      await this.catalog(job);
      const compared = compareExactNumeric(raw, job.threshold);
      if (compared === null) throw new BadRequestException('지원하는 숫자 정밀도를 확인해 주세요.');
      const value = raw;
      outcome = (job.operator === 'gt' ? compared > 0 : compared < 0) ? 'matched' : 'not_matched';
      result = encryptConnectionConfig(
        JSON.stringify({
          title: block.title,
          value,
          display: block.display,
          queriedAt: query.queriedAt,
          viewRevision: job.viewRevision,
        }),
      );
    } catch (error) {
      result = null;
      outcome = error?.status === 403 ? 'denied' : error?.status === 409 ? 'stale' : 'failed';
    }
    // One bounded catch-up occurrence; skip missed periods instead of an unbounded replay burst.
    const nextAt = new Date(Date.now() + job.intervalSeconds * 1000).toISOString();
    await serializedViewWrite(this.db.getRepository(Database), () =>
      this.db.transaction(async manager => {
        const locked = await manager.findOne(ConditionReport, {
          where: { id },
          ...(this.db.options.type !== 'sqlite'
            ? { lock: { mode: 'pessimistic_write' as const } }
            : {}),
        });
        if (
          !locked?.active ||
          locked.version !== job.version ||
          locked.leaseToken !== lease ||
          locked.nextAt !== job.nextAt ||
          !locked.leaseUntil ||
          locked.leaseUntil <= now()
        )
          return;
        if (result) {
          try {
            await this.catalog(job);
          } catch (error) {
            result = null;
            outcome = error?.status === 403 ? 'denied' : error?.status === 409 ? 'stale' : 'failed';
          }
        }
        const exists = await manager.findOneBy(ConditionReportOccurrence, {
          reportId: id,
          scheduledAt: job.nextAt,
        });
        if (!exists)
          await manager.save(ConditionReportOccurrence, {
            id: randomUUID(),
            reportId: id,
            scheduledAt: job.nextAt,
            outcome,
            result,
          });
        const changed = await manager
          .createQueryBuilder()
          .update(ConditionReport)
          .set({ nextAt, leaseToken: null, leaseUntil: null })
          .where(
            'id = :id AND active = :active AND version = :version AND leaseToken = :lease AND nextAt = :due',
            { id, active: true, version: job.version, lease, due: job.nextAt },
          )
          .andWhere('leaseUntil > :commitTime', { commitTime: now() })
          .execute();
        if (changed.affected !== 1) throw new ConflictException('예약 실행 상태가 바뀌었습니다.');
      }),
    );
  }
}
