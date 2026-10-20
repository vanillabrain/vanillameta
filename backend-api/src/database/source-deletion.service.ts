import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import {
  DataSource,
  EntityManager,
  In,
  MoreThan,
  LessThan,
  Not,
  IsNull,
  QueryFailedError,
} from 'typeorm';
import * as path from 'path';
import * as fs from 'fs/promises';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from '../enterprise/entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from '../enterprise/entities/enterprise-group.entity';
import { Metric } from '../metric/entities/metric.entity';
import { lockMetricSources } from '../metric/metric-write-lock';
import { Database } from './entities/database.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioExecution } from '../dashboard-studio/entities/studio-execution.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { ExploreView } from '../bi/entities/explore-view.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { CommerceSource } from '../commerce/entities/commerce-source.entity';
import { SourceCatalogEntry } from '../bi/entities/source-catalog-entry.entity';
import { SourceConditionEntry } from '../bi/entities/source-condition-entry.entity';
import { SourceDeleteReceipt } from './entities/source-delete-receipt.entity';
import {
  parseConnectionConfig,
  encryptConnectionConfig,
  decryptConnectionConfig,
} from '../utils/crypto.util';
import {
  DuckDBService,
  DeletionImportProof,
  DeletionSqliteProof,
} from '../analysis/duckdb.service';
import { ConnectionService } from '../connection/connection.service';
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[a-f0-9]{12}$/;
export const SOURCE_DELETE_DEPENDENCY_KINDS = [
  'datasets',
  'tableQueries',
  'metrics',
  'dashboards',
  'exploreViews',
  'directPermissions',
  'groupPermissions',
  'publications',
  'exportJobs',
  'sharedFiles',
] as const;
type FileTarget = { kind: 'duckdb' | 'sqlite'; filename: string };
type FileEntry = FileTarget & { proof: DeletionImportProof | DeletionSqliteProof; done: boolean };
type CleanupPlan = { version: 1; connectionClosed: boolean; files: FileEntry[] };
const LEASE_MS = 10 * 60 * 1000;
@Injectable()
export class SourceDeletionService {
  constructor(
    private readonly db: DataSource,
    private readonly duckdb: DuckDBService,
    private readonly connection: ConnectionService,
  ) {}
  private id(value: unknown) {
    const id = typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
    if (!positive(id)) throw new BadRequestException('소스 번호를 확인해 주세요.');
    return id;
  }
  private async scope(actor: number, epoch: number, m: EntityManager, lock = false) {
    if (!positive(actor)) throw new ForbiddenException('본인 계정 확인이 필요합니다.');
    const locking =
      lock && ['mysql', 'mariadb'].includes(this.db.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {};
    const user = await m.findOne(User, {
      where: { id: actor },
      select: { id: true, active: true, authVersion: true },
      ...locking,
    });
    if (!user?.active) throw new ForbiddenException('활성 본인 계정이 필요합니다.');
    if (!Number.isSafeInteger(epoch) || epoch < 0 || (user.authVersion ?? 0) !== epoch)
      throw new UnauthorizedException('로그인 상태를 다시 확인해 주세요.');
    const member = await m.findOne(EnterpriseMembership, { where: { userId: actor }, ...locking });
    if (member && !positive(member.organizationId))
      throw new InternalServerErrorException('현재 조직을 확인할 수 없습니다.');
    return member?.organizationId ?? null;
  }
  private tx<T>(run: (m: EntityManager) => Promise<T>) {
    return ['mysql', 'mariadb'].includes(this.db.options.type)
      ? metadataTransaction(this.db, 'READ COMMITTED', run)
      : metadataTransaction(this.db, run);
  }
  private async owned(id: number, actor: number, m: EntityManager, lock = false) {
    const row = lock
      ? (await lockMetricSources(m, [id])).get(id)
      : await m.findOneBy(Database, { id });
    if (!row || row.ownerId !== actor)
      throw new ForbiddenException('삭제할 본인 소스를 확인할 수 없습니다.');
    return row;
  }
  private parse(value: string) {
    try {
      const obj = JSON.parse(value);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch {}
    throw new ConflictException('저장된 사용처를 확인할 수 없습니다. 삭제하지 않았습니다.');
  }
  private async revision(row: Database, m: EntityManager) {
    const catalog = await m.findOne(SourceCatalogEntry, {
      where: { sourceId: row.id },
      select: { version: true },
      order: { version: 'DESC' },
    });
    const conditions = await m.findOne(SourceConditionEntry, {
      where: { sourceId: row.id },
      select: { version: true },
      order: { version: 'DESC' },
    });
    return hash([
      row.id,
      row.ownerId,
      row.catalogActive,
      row.catalogVersion,
      row.name,
      row.description,
      row.connectionConfig,
      row.engine,
      row.type,
      row.timezone,
      row.createdAt,
      row.updatedAt,
      catalog?.version ?? 0,
      conditions?.version ?? 0,
    ]);
  }
  private targets(row: Database): FileTarget[] {
    const engine = String(row.engine).toLowerCase();
    if (!['duckdb', 'sqlite', 'sqlite3', 'better-sqlite3'].includes(engine)) return [];
    let config: any;
    try {
      config = parseConnectionConfig(row.connectionConfig);
    } catch {
      throw new ConflictException('관리 파일 설정을 확인할 수 없습니다.');
    }
    const root = path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads');
    const filename = config?.connection?.filename;
    if (typeof filename !== 'string' || !filename)
      throw new ConflictException('관리 파일 설정을 확인할 수 없습니다.');
    if (engine !== 'duckdb') {
      const relative = path.relative(root, path.resolve(filename));
      return /^sample-[0-9a-f-]{36}\.db$/.test(relative)
        ? [{ kind: 'sqlite', filename: path.resolve(filename) }]
        : [];
    }
    const versions = config.fileVersions;
    if (
      versions !== undefined &&
      (!Array.isArray(versions) ||
        !versions.length ||
        versions.length > 5 ||
        versions.some(v => typeof v?.filename !== 'string' || !v.filename))
    )
      throw new ConflictException('관리 파일 버전을 확인할 수 없습니다.');
    const files = [
      ...new Set<string>(
        [filename, ...(versions ?? []).map(v => v.filename)].map(f => path.resolve(f)),
      ),
    ];
    if (files.length > 5) throw new ConflictException('관리 파일 버전을 확인할 수 없습니다.');
    // External local database files are never removed by source deletion.
    return files
      .filter(f => /^[0-9a-f-]{36}[\\/]data\.duckdb$/.test(path.relative(root, f)))
      .map(filename => ({ kind: 'duckdb', filename }));
  }
  private async canonical(filename: string) {
    let current = path.resolve(filename);
    const missing: string[] = [];
    while (true) {
      try {
        return path.join(await fs.realpath(current), ...missing.reverse());
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error.code))
          throw new ConflictException('관리 파일 경계를 확인할 수 없습니다.');
        const parent = path.dirname(current);
        if (parent === current) throw new ConflictException('관리 파일 경계를 확인할 수 없습니다.');
        missing.push(path.basename(current));
        current = parent;
      }
    }
  }
  private async sharedFiles(targets: FileTarget[], m: EntityManager, exclude?: number) {
    if (!targets.length) return 0;
    const scopes = await Promise.all(
      targets.map(async file => ({ kind: file.kind, path: await this.canonical(file.filename) })),
    );
    const overlaps = async (filename: string) => {
      const actual = await this.canonical(filename);
      return scopes.some(scope =>
        scope.kind === 'duckdb'
          ? (() => {
              const relative = path.relative(path.dirname(scope.path), actual);
              return (
                relative === '' ||
                (!relative.startsWith('..' + path.sep) &&
                  relative !== '..' &&
                  !path.isAbsolute(relative))
              );
            })()
          : [
              scope.path,
              scope.path + '-wal',
              scope.path + '-shm',
              scope.path + '-journal',
            ].includes(actual),
      );
    };
    let count = 0;
    for (const other of await m.find(Database)) {
      if (
        other.id === exclude ||
        !['duckdb', 'sqlite', 'sqlite3', 'better-sqlite3'].includes(
          String(other.engine).toLowerCase(),
        )
      )
        continue;
      let config: any;
      try {
        config = parseConnectionConfig(other.connectionConfig);
      } catch {
        throw new ConflictException('관리 파일의 다른 연결을 확인할 수 없습니다.');
      }
      if (
        config.fileVersions !== undefined &&
        (!Array.isArray(config.fileVersions) ||
          config.fileVersions.length === 0 ||
          config.fileVersions.length > 5)
      )
        throw new ConflictException('관리 파일의 다른 버전을 확인할 수 없습니다.');
      const filenames = [
        config?.connection?.filename,
        ...(Array.isArray(config?.fileVersions) ? config.fileVersions.map(v => v?.filename) : []),
      ];
      if (filenames.some(f => typeof f !== 'string' || !f))
        throw new ConflictException('관리 파일의 다른 연결을 확인할 수 없습니다.');
      if ((await Promise.all(filenames.map(overlaps))).some(Boolean)) count++;
    }
    for (const other of await m.find(CommerceSource))
      if (other.publishedFilename && (await overlaps(other.publishedFilename))) count++;
    return count;
  }
  private async boardHint(row: Dashboard, m: EntityManager): Promise<number | null> {
    const ids = new Set<number>();
    try {
      const a = row.analysisDefinition && JSON.parse(row.analysisDefinition);
      if (positive(a?.databaseId)) ids.add(a.databaseId);
    } catch {}
    for (const link of await m.find(DashboardWidget, { where: { dashboardId: row.id } })) {
      const widget = await m.findOneBy(Widget, { id: link.widgetId });
      const entity =
        widget?.datasetType === 'DATASET'
          ? Dataset
          : widget?.datasetType === 'TABLE'
          ? TableQuery
          : null;
      if (!entity) return null;
      const set: any = await m.findOne(entity as any, { where: { id: widget.datasetId } });
      if (!positive(set?.databaseId)) return null;
      ids.add(set.databaseId);
    }
    return ids.size === 1 ? [...ids][0] : null;
  }
  private async *boards(m: EntityManager) {
    let after = 0;
    while (true) {
      const rows = await m.find(Dashboard, {
        where: { id: MoreThan(after), delYn: 'N' },
        select: {
          id: true,
          analysisDefinition: true,
          structuredDefinition: true,
          pivotDefinitions: true,
        },
        order: { id: 'ASC' },
        take: 200,
      });
      if (!rows.length) return;
      for (const row of rows) yield row;
      after = rows[rows.length - 1].id;
    }
  }
  private async dependencies(row: Database, m: EntityManager, targets = this.targets(row)) {
    const values: Record<(typeof SOURCE_DELETE_DEPENDENCY_KINDS)[number], number> = {
      datasets: await m.count(Dataset, { where: { databaseId: row.id } }),
      tableQueries: await m.count(TableQuery, { where: { databaseId: row.id } }),
      metrics: await m.count(Metric, { where: { databaseId: row.id, useYn: 'Y' } }),
      dashboards: 0,
      exploreViews:
        (await m.count(ExploreView, { where: { sourceId: row.id } })) +
        (await m.count(PersonalView, { where: { sourceId: row.id } })),
      directPermissions: 0,
      groupPermissions: 0,
      publications: 0,
      exportJobs: 0,
      sharedFiles: await this.sharedFiles(targets, m, row.id),
    };
    for (const [entity, kind] of [
      [EnterpriseResourceGrant, 'directPermissions'],
      [EnterpriseGroupGrant, 'groupPermissions'],
    ] as const)
      values[kind] = await m
        .createQueryBuilder(entity, 'g')
        .where('g.resourceKind = :kind AND g.resourceId = :id', { kind: 'source', id: row.id })
        .andWhere('(g.read <> :off OR g.edit <> :off OR g.publish <> :off OR g.export <> :off)', {
          off: false,
        })
        .getCount();
    values.publications =
      (await m
        .createQueryBuilder(DashboardPublication, 'p')
        .where('p.sourceId = :id AND p.active <> :off', { id: row.id, off: false })
        .getCount()) +
      (await m
        .createQueryBuilder(StudioPublication, 'p')
        .where('p.sourceId = :id', { id: row.id })
        .andWhere('(p.revokedAt IS NULL OR p.revokedAt = :empty)', { empty: '' })
        .getCount());
    values.exportJobs = await m
      .createQueryBuilder(ExportJob, 'j')
      .where('j.sourceId = :id', { id: row.id })
      .andWhere('(j.status IN (:...live) OR (j.status = :ready AND j.expiresAt > :now))', {
        live: ['queued', 'running'],
        ready: 'ready',
        now: new Date(),
      })
      .getCount();
    for await (const board of this.boards(m)) {
      let related = false;
      const hint = () => this.boardHint(board, m);
      for (const [text, field] of [
        [board.analysisDefinition, 'databaseId'],
        [board.structuredDefinition, 'sourceId'],
      ] as const) {
        if (!text) continue;
        try {
          const data = this.parse(text);
          if (!positive(data[field])) throw new Error();
          if (data[field] === row.id) related = true;
        } catch {
          const source = await hint();
          if (source === row.id || source === null)
            throw new ConflictException('저장 분석의 소스 연결을 확인할 수 없습니다.');
        }
      }
      if (board.pivotDefinitions) {
        let pivots: any;
        try {
          pivots = JSON.parse(board.pivotDefinitions);
          if (!Array.isArray(pivots) || pivots.some(p => !positive(p?.sourceId))) throw new Error();
        } catch {
          const source = await hint();
          if (source === row.id || source === null)
            throw new ConflictException('Pivot 소스 연결을 확인할 수 없습니다.');
          pivots = [];
        }
        if (pivots.some(p => p.sourceId === row.id)) related = true;
      }
      const state = await m.findOneBy(StudioState, { dashboardId: board.id });
      if (state) {
        try {
          const doc = this.parse(state.document).document;
          if (!positive(doc?.sourceId)) throw new Error();
          if (doc.sourceId === row.id) related = true;
        } catch {
          const source = await hint();
          if (source === row.id || source === null)
            throw new ConflictException('Studio 소스 연결을 확인할 수 없습니다.');
        }
      }
      for (const run of await m.find(StudioExecution, {
        where: {
          dashboardId: board.id,
          status: In(['pending', 'running', 'partial', 'interrupted', 'failed']),
        },
        select: { state: true },
      })) {
        try {
          const source = this.parse(run.state).request?.document?.sourceId;
          if (!positive(source)) throw new Error();
          if (source === row.id) related = true;
        } catch {
          const source = await hint();
          if (source === row.id || source === null)
            throw new ConflictException('진행 중 실행의 소스 연결을 확인할 수 없습니다.');
        }
      }
      if (related) values.dashboards++;
    }
    return SOURCE_DELETE_DEPENDENCY_KINDS.map(kind => ({ kind, count: values[kind] }));
  }
  async impact(value: unknown, actor: number, epoch = 0) {
    const id = this.id(value);
    return serializeMetadataWork(this.db, async () => {
      const org = await this.scope(actor, epoch, this.db.manager),
        row = await this.owned(id, actor, this.db.manager);
      const revision = await this.revision(row, this.db.manager),
        targets = this.targets(row),
        dependencies = await this.dependencies(row, this.db.manager, targets);
      const current = await this.owned(id, actor, this.db.manager);
      if (
        (await this.scope(actor, epoch, this.db.manager)) !== org ||
        (await this.revision(current, this.db.manager)) !== revision
      )
        throw new ConflictException('소스 삭제 기준이 변경되었습니다. 다시 확인해 주세요.');
      return {
        status: 'SUCCESS',
        data: {
          sourceId: id,
          actorId: actor,
          organizationId: org,
          revision,
          canDelete: dependencies.every(d => d.count === 0),
          managedFileCount: targets.length,
          dependencies,
        },
      };
    });
  }
  private input(body: any) {
    const keys = ['requestId', 'expectedRevision', 'expectedActorId', 'expectedOrganizationId'];
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== keys.length ||
      Object.keys(body).some(key => !keys.includes(key)) ||
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        body.requestId,
      ) ||
      typeof body.expectedRevision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.expectedRevision) ||
      !positive(body.expectedActorId) ||
      !(body.expectedOrganizationId === null || positive(body.expectedOrganizationId))
    )
      throw new BadRequestException('사용처와 삭제 요청을 먼저 확인해 주세요.');
    return {
      requestId: body.requestId as string,
      expectedRevision: body.expectedRevision as string,
      expectedActorId: body.expectedActorId as number,
      expectedOrganizationId: body.expectedOrganizationId as number | null,
    };
  }

  private receipt(row: SourceDeleteReceipt, replayed: boolean) {
    return {
      status: 'SUCCESS',
      data: {
        sourceId: row.sourceId,
        requestId: row.requestId,
        receiptId: row.id,
        deleted: true,
        replayed,
        cleanup: { status: row.cleanupStatus, managedFiles: row.managedFiles },
      },
    };
  }
  private plan(row: SourceDeleteReceipt): CleanupPlan {
    try {
      const value = JSON.parse(decryptConnectionConfig(row.filePlan));
      if (
        value?.version !== 1 ||
        typeof value.connectionClosed !== 'boolean' ||
        !Array.isArray(value.files) ||
        value.files.length !== row.managedFiles ||
        value.files.length > 5 ||
        value.files.some(
          f =>
            !['duckdb', 'sqlite'].includes(f?.kind) ||
            typeof f.filename !== 'string' ||
            !f.filename ||
            typeof f.done !== 'boolean' ||
            !f.proof ||
            typeof f.proof !== 'object',
        )
      )
        throw new Error();
      return value;
    } catch {
      throw new ConflictException(
        '파일 정리 계획을 확인할 수 없습니다. 관리자에게 복구를 요청해 주세요.',
      );
    }
  }
  private async prepareFiles(row: Database): Promise<CleanupPlan> {
    const files: FileEntry[] = [];
    for (const target of this.targets(row)) {
      const proof =
        target.kind === 'duckdb'
          ? await this.duckdb.validateDeletionImport(target.filename, row.id, {
              allowUnregistered: true,
              allowMissing: true,
            })
          : await this.duckdb.validateDeletionSqlite(target.filename, row.id);
      files.push({ ...target, proof, done: false });
    }
    const plan: CleanupPlan = { version: 1, connectionClosed: false, files };
    if (Buffer.byteLength(JSON.stringify(plan)) > 65536)
      throw new ConflictException('파일 정리 계획이 한도를 초과했습니다.');
    return plan;
  }
  private requestId(body: any) {
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !UUID.test(body.requestId ?? '')
    )
      throw new BadRequestException('원래 삭제 요청 번호를 확인해 주세요.');
    return body.requestId as string;
  }
  private async audit(m: EntityManager, row: SourceDeleteReceipt, action: string, version: number) {
    if (row.organizationId !== null)
      await m.insert(EnterpriseAuditEvent, {
        organizationId: row.organizationId,
        actorId: row.actorId,
        subjectId: row.actorId,
        action,
        resourceId: row.id,
        version,
      });
  }
  async remove(value: unknown, actor: number, body: unknown, epoch = 0) {
    const id = this.id(value),
      input = this.input(body),
      digest = hash([
        id,
        input.expectedRevision,
        input.expectedActorId,
        input.expectedOrganizationId,
      ]);
    let result: ReturnType<SourceDeletionService['receipt']>;
    try {
      result = await this.tx(async m => {
        const org = await this.scope(actor, epoch, m, true);
        if (input.expectedActorId !== actor || input.expectedOrganizationId !== org)
          throw new ConflictException(
            '계정 또는 조직이 변경되었습니다. 삭제 영향을 다시 확인해 주세요.',
          );
        const prior = await m.findOneBy(SourceDeleteReceipt, {
          actorId: actor,
          requestId: input.requestId,
        });
        if (prior) {
          if (prior.organizationId !== org || prior.digest !== digest)
            throw new ConflictException('같은 요청 번호의 삭제 기준이 다릅니다.');
          return this.receipt(prior, true);
        }
        const row = await this.owned(id, actor, m, true);
        if ((await this.revision(row, m)) !== input.expectedRevision)
          throw new ConflictException('소스 기준이 변경되었습니다. 사용처를 다시 확인해 주세요.');
        const dependencies = await this.dependencies(row, m);
        if (dependencies.some(d => d.count > 0))
          throw new ConflictException(
            '사용처가 남아 있습니다. 연결 자원을 명시적으로 정리한 뒤 다시 확인해 주세요.',
          );
        let plan: CleanupPlan;
        try {
          plan = await this.prepareFiles(row);
        } catch {
          throw new ConflictException(
            '관리 파일의 소유·경계를 확인할 수 없습니다. 소스와 파일은 유지됩니다.',
          );
        }
        const removed = await m.delete(Database, {
          id,
          ownerId: actor,
          connectionConfig: row.connectionConfig,
        });
        if (removed.affected !== 1) throw new ConflictException('소스 기준이 변경되었습니다.');
        const saved = await m.save(SourceDeleteReceipt, {
          actorId: actor,
          organizationId: org,
          sourceId: id,
          requestId: input.requestId,
          expectedRevision: input.expectedRevision,
          digest,
          filePlan: encryptConnectionConfig(JSON.stringify(plan)),
          managedFiles: plan.files.length,
          cleanupStatus: 'pending',
          cleanupVersion: 0,
          cleanupAttempt: null,
          cleanupLeaseUntil: null,
        });
        await this.audit(m, saved, 'source-deletion.completed', 1);
        if ((await this.scope(actor, epoch, m)) !== org)
          throw new ConflictException('현재 조직이 변경되었습니다.');
        return this.receipt(saved, false);
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
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
        throw new ConflictException(
          '삭제 요청이 경합 중입니다. 같은 요청으로 결과를 확인해 주세요.',
        );
      throw new InternalServerErrorException(
        '소스 삭제를 확정하지 못했습니다. 같은 요청으로 결과를 확인해 주세요.',
      );
    }
    // A fresh connection-only deletion has no filesystem side effect to confirm separately.
    if (!result.data.replayed && result.data.cleanup.managedFiles === 0)
      return this.cleanup(
        result.data.receiptId,
        actor,
        { requestId: result.data.requestId },
        epoch,
      );
    return result;
  }
  private async receiptOwner(
    id: number,
    actor: number,
    epoch: number,
    m: EntityManager,
    lock = false,
  ) {
    const org = await this.scope(actor, epoch, m, lock);
    const row = await m.findOne(SourceDeleteReceipt, {
      where: { id },
      ...(lock && ['mysql', 'mariadb'].includes(this.db.options.type)
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!row || row.actorId !== actor || row.organizationId !== org)
      throw new ForbiddenException('본인 현재 조직의 삭제 결과만 확인할 수 있습니다.');
    return row;
  }
  async getReceipt(value: unknown, actor: number, epoch = 0) {
    const id = this.id(value);
    return serializeMetadataWork(this.db, async () =>
      this.receipt(await this.receiptOwner(id, actor, epoch, this.db.manager), true),
    );
  }
  async listReceipts(actor: number, query: any = {}, epoch = 0) {
    if (
      !query ||
      typeof query !== 'object' ||
      Array.isArray(query) ||
      Object.keys(query).some(k => k !== 'beforeId')
    )
      throw new BadRequestException('정리 목록 조건을 확인해 주세요.');
    const before = query.beforeId === undefined ? undefined : this.id(query.beforeId);
    return serializeMetadataWork(this.db, async () => {
      const org = await this.scope(actor, epoch, this.db.manager);
      const rows = await this.db.manager.find(SourceDeleteReceipt, {
        where: {
          actorId: actor,
          organizationId: org === null ? IsNull() : org,
          cleanupStatus: Not('complete'),
          ...(before ? { id: LessThan(before) } : {}),
        },
        order: { id: 'DESC' },
        take: 21,
      });
      // Nullable organization matching must be exact; never query all organizations for a legacy account.
      const visible = rows.filter(r => r.organizationId === org);
      if ((await this.scope(actor, epoch, this.db.manager)) !== org)
        throw new ConflictException('현재 조직이 변경되었습니다.');
      return {
        status: 'SUCCESS',
        data: {
          actorId: actor,
          organizationId: org,
          entries: visible.slice(0, 20).map(r => this.receipt(r, true).data),
          nextBeforeId: visible.length > 20 ? visible[19].id : null,
        },
      };
    });
  }
  async cleanup(value: unknown, actor: number, body: unknown, epoch = 0) {
    const id = this.id(value),
      requestId = this.requestId(body);
    const claim = await this.tx(async m => {
      const row = await this.receiptOwner(id, actor, epoch, m, true);
      if (row.requestId !== requestId)
        throw new ConflictException('원래 삭제 요청 번호가 다릅니다.');
      if (
        row.cleanupStatus === 'complete' ||
        (row.cleanupAttempt &&
          row.cleanupLeaseUntil &&
          row.cleanupLeaseUntil.getTime() > Date.now())
      )
        return { ready: this.receipt(row, true) };
      if (await m.exists(Database, { where: { id: row.sourceId } }))
        throw new ConflictException(
          '같은 번호의 소스가 있어 이전 파일 정리를 수행하지 않았습니다.',
        );
      const plan = this.plan(row);
      if ((await this.sharedFiles(plan.files, m)) > 0)
        throw new ConflictException(
          '다른 자료가 관리 파일을 사용하고 있습니다. 파일을 정리하지 않았습니다.',
        );
      const attempt = randomUUID(),
        version = row.cleanupVersion + 1;
      const update = await m.update(
        SourceDeleteReceipt,
        { id, cleanupVersion: row.cleanupVersion },
        {
          cleanupStatus: 'pending',
          cleanupAttempt: attempt,
          cleanupVersion: version,
          cleanupLeaseUntil: new Date(Date.now() + LEASE_MS),
        },
      );
      if (update.affected !== 1) throw new ConflictException('파일 정리 상태가 변경되었습니다.');
      return {
        row: {
          ...row,
          cleanupAttempt: attempt,
          cleanupVersion: version,
          cleanupStatus: 'pending' as const,
        },
        plan,
        attempt,
      };
    });
    if ('ready' in claim) return claim.ready;
    const { row, plan, attempt } = claim;
    let lost = false,
      beating = false;
    const timer = setInterval(async () => {
      if (beating || lost) return;
      beating = true;
      try {
        const result = await this.tx(m =>
          m.update(
            SourceDeleteReceipt,
            {
              id,
              cleanupAttempt: attempt,
              cleanupStatus: 'pending',
              cleanupLeaseUntil: MoreThan(new Date()),
            },
            { cleanupLeaseUntil: new Date(Date.now() + LEASE_MS) },
          ),
        );
        if (result.affected !== 1) lost = true;
      } catch {
        lost = true;
      } finally {
        beating = false;
      }
    }, 2000);
    timer.unref?.();
    const checkpoint = async (complete = false) =>
      this.tx(async m => {
        const current = await this.receiptOwner(id, actor, epoch, m, true);
        if (
          lost ||
          current.cleanupAttempt !== attempt ||
          current.cleanupStatus !== 'pending' ||
          !current.cleanupLeaseUntil ||
          current.cleanupLeaseUntil.getTime() <= Date.now()
        )
          throw new ConflictException('파일 정리 실행 상태를 다시 확인해 주세요.');
        if (await m.exists(Database, { where: { id: row.sourceId } }))
          throw new ConflictException(
            '같은 번호의 소스가 있어 이전 파일 정리를 수행하지 않았습니다.',
          );
        if (
          (await this.sharedFiles(
            plan.files.filter(f => !f.done),
            m,
          )) > 0
        )
          throw new ConflictException('다른 자료가 관리 파일을 사용하고 있습니다.');
        const version = current.cleanupVersion + 1;
        const changed = await m.update(
          SourceDeleteReceipt,
          { id, cleanupAttempt: attempt, cleanupVersion: current.cleanupVersion },
          {
            filePlan: encryptConnectionConfig(JSON.stringify(plan)),
            cleanupVersion: version,
            ...(complete
              ? { cleanupStatus: 'complete', cleanupAttempt: null, cleanupLeaseUntil: null }
              : { cleanupLeaseUntil: new Date(Date.now() + LEASE_MS) }),
          },
        );
        if (changed.affected !== 1) throw new ConflictException('파일 정리 상태가 변경되었습니다.');
        if (complete) await this.audit(m, current, 'source-cleanup.completed', version);
        return this.receipt(
          { ...current, cleanupVersion: version, cleanupStatus: complete ? 'complete' : 'pending' },
          false,
        );
      });
    try {
      await checkpoint();
      if (!plan.connectionClosed) {
        await this.connection.removeKnex(row.sourceId);
        plan.connectionClosed = true;
        await checkpoint();
      }
      for (const file of plan.files) {
        if (file.done) continue;
        await checkpoint();
        if (file.kind === 'duckdb')
          await this.duckdb.removeOwnedImport(
            file.filename,
            row.sourceId,
            file.proof as DeletionImportProof,
          );
        else
          await this.duckdb.removeOwnedSqlite(
            file.filename,
            row.sourceId,
            file.proof as DeletionSqliteProof,
          );
        file.done = true;
        await checkpoint();
      }
      return await checkpoint(true);
    } catch {
      // Already removed bytes cannot be rolled back; the encrypted plan retains exact progress.
      return await this.tx(async m => {
        const current = await this.receiptOwner(id, actor, epoch, m, true);
        if (current.cleanupAttempt !== attempt) return this.receipt(current, true);
        const version = current.cleanupVersion + 1;
        const changed = await m.update(
          SourceDeleteReceipt,
          { id, cleanupAttempt: attempt, cleanupVersion: current.cleanupVersion },
          {
            filePlan: encryptConnectionConfig(JSON.stringify(plan)),
            cleanupStatus: 'retry_required',
            cleanupVersion: version,
            cleanupAttempt: null,
            cleanupLeaseUntil: null,
          },
        );
        if (changed.affected !== 1) throw new ConflictException('파일 정리 상태가 변경되었습니다.');
        await this.audit(m, current, 'source-cleanup.retry-required', version);
        return this.receipt(
          { ...current, cleanupStatus: 'retry_required', cleanupVersion: version },
          false,
        );
      });
    } finally {
      clearInterval(timer);
    }
  }
}
