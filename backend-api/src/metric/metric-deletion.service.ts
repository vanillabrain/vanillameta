import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { DataSource, EntityManager, MoreThan, QueryFailedError } from 'typeorm';
import { metadataTransaction, serializeMetadataWork } from '../common/metadata-work';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from '../enterprise/entities/enterprise-audit-event.entity';
import { Metric } from './entities/metric.entity';
import { Database } from '../database/entities/database.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Widget } from '../widget/entities/widget.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { ExploreView } from '../bi/entities/explore-view.entity';
import { ExportJob } from '../bi/entities/export-job.entity';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { lockMetricWrite, lockMetricSources } from './metric-write-lock';
import { MetricDeleteReceipt } from './entities/metric-delete-receipt.entity';

const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const METRIC_DELETE_DEPENDENCY_KINDS = [
  'dashboardDefinitions',
  'studioDocuments',
  'exploreViews',
  'exportJobs',
] as const;
export function metricDeletionRevision(row: Metric) {
  return hash([
    row.id,
    row.databaseId,
    row.definition,
    row.name,
    row.description,
    row.tableName,
    row.aggregation,
    row.expression,
    row.groupBy,
    row.filters,
    row.useYn,
    row.createdAt,
    row.updatedAt,
  ]);
}
@Injectable()
export class MetricDeletionService {
  constructor(private readonly db: DataSource) {}
  private id(value: unknown) {
    const id = typeof value === 'string' && /^[1-9][0-9]*$/.test(value) ? Number(value) : value;
    if (!positive(id)) throw new BadRequestException('지표 번호를 확인해 주세요.');
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
  private async owned(id: number, actor: number, m: EntityManager, lock = false) {
    // Source first, Metric second: every current reference writer uses the same parent fence.
    const hint = await m.findOneBy(Metric, { id });
    if (!hint || !positive(hint.databaseId))
      throw new ForbiddenException('지표 소유권을 확인할 수 없습니다.');
    const source = lock
      ? (await lockMetricSources(m, [hint.databaseId])).get(hint.databaseId)
      : await m.findOneBy(Database, { id: hint.databaseId });
    const row = lock ? await lockMetricWrite(m, id) : await m.findOneBy(Metric, { id });
    if (
      !source ||
      source.ownerId !== actor ||
      !row ||
      row.databaseId !== source.id ||
      row.useYn !== 'Y'
    )
      throw new ForbiddenException('삭제할 본인 지표를 확인할 수 없습니다.');
    return row;
  }
  private parse(value: string) {
    try {
      const obj = JSON.parse(value);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch {}
    throw new ConflictException('저장된 사용처 정의를 확인할 수 없습니다. 삭제하지 않았습니다.');
  }
  private async dashboardSource(row: Dashboard, m: EntityManager) {
    // Only explicit metadata source identities; never infer a source or reference from SQL/labels.
    const ids = new Set<number>();
    try {
      const analysis = row.analysisDefinition && JSON.parse(row.analysisDefinition);
      if (positive(analysis?.databaseId)) ids.add(analysis.databaseId);
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
  private async *currentBoards(m: EntityManager) {
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
  private async dependencies(row: Metric, m: EntityManager) {
    let dashboardDefinitions = 0,
      studioDocuments = 0,
      exploreViews = 0,
      exportJobs = 0;
    // Current root existence is deliberate: orphaned historical StudioState is not a current use.
    for await (const board of this.currentBoards(m)) {
      let sourceId: number | null = null;
      let boardReferenced = false;
      if (board.structuredDefinition) {
        let definition: any;
        try {
          definition = this.parse(board.structuredDefinition);
        } catch (error) {
          sourceId = await this.dashboardSource(board, m);
          if (sourceId === row.databaseId || sourceId === null) throw error;
        }
        if (definition) {
          sourceId = positive(definition.sourceId)
            ? definition.sourceId
            : await this.dashboardSource(board, m);
          const entries =
            definition.kind === 'structured-bi' && definition.schemaVersion === 1
              ? [definition]
              : ((definition.kind === 'metric-linked-analysis' && definition.schemaVersion === 1) ||
                  (definition.kind === 'structured-bi-dashboard' &&
                    definition.schemaVersion === 2)) &&
                Array.isArray(definition.items)
              ? definition.items
              : null;
          if (!entries && (sourceId === row.databaseId || sourceId === null))
            throw new ConflictException('저장 분석의 지표 연결을 확인할 수 없습니다.');
          if (entries?.some(item => item?.metricId === row.id)) boardReferenced = true;
          if (
            (sourceId === row.databaseId || sourceId === null) &&
            entries?.some(
              item =>
                !item ||
                typeof item !== 'object' ||
                Array.isArray(item) ||
                (item.metricId !== undefined && !positive(item.metricId)),
            )
          )
            throw new ConflictException('저장 분석의 지표 연결을 확인할 수 없습니다.');
        }
      }
      if (board.pivotDefinitions) {
        let pivots: any;
        try {
          pivots = JSON.parse(board.pivotDefinitions);
          if (!Array.isArray(pivots)) throw new Error();
        } catch {
          pivots = [];
          sourceId ??= await this.dashboardSource(board, m);
          if (sourceId === row.databaseId || sourceId === null)
            throw new ConflictException('Pivot 지표 연결을 확인할 수 없습니다.');
        }
        for (const pivot of pivots ?? []) {
          if (positive(pivot?.sourceId) && pivot.sourceId !== row.databaseId) continue;
          if (
            !positive(pivot?.sourceId) ||
            !Array.isArray(pivot?.state?.measureIds) ||
            pivot.state.measureIds.some(id => !positive(id))
          )
            throw new ConflictException('Pivot 지표 연결을 확인할 수 없습니다.');
          if (pivot.state.measureIds.includes(row.id)) boardReferenced = true;
        }
      }
      if (boardReferenced) dashboardDefinitions++;
      const state = await m.findOneBy(StudioState, { dashboardId: board.id });
      if (!state) continue;
      let document: any;
      try {
        const envelope = this.parse(state.document);
        document = envelope.document;
        if (!document || typeof document !== 'object' || Array.isArray(document))
          throw new ConflictException('Studio 문서 연결을 확인할 수 없습니다.');
      } catch (error) {
        sourceId ??= await this.dashboardSource(board, m);
        if (sourceId === row.databaseId || sourceId === null) throw error;
        continue;
      }
      if (document.sourceId !== row.databaseId) {
        // A valid other-source document cannot depend on this source's metric.
        if (positive(document.sourceId)) {
          if (
            Array.isArray(document.blocks) &&
            document.blocks.some(
              block =>
                Array.isArray(block?.measureRefs) &&
                block.measureRefs.some(ref => ref?.id === row.id),
            )
          )
            studioDocuments++;
          continue;
        }
        throw new ConflictException('Studio 소스 연결을 확인할 수 없습니다.');
      }
      if (
        document.schemaVersion !== 1 ||
        !Array.isArray(document.blocks) ||
        document.blocks.some(
          block =>
            !Array.isArray(block?.measureRefs) || block.measureRefs.some(ref => !positive(ref?.id)),
        )
      )
        throw new ConflictException('Studio 지표 연결을 확인할 수 없습니다.');
      if (document.blocks.some(block => block.measureRefs.some(ref => ref.id === row.id)))
        studioDocuments++;
    }
    for (const view of await m.find(ExploreView, { where: { sourceId: row.databaseId } })) {
      const state = this.parse(view.state),
        versions = this.parse(view.measureVersions);
      if (
        !Array.isArray(state.measureIds) ||
        state.measureIds.length < 1 ||
        state.measureIds.length > 6 ||
        new Set(state.measureIds).size !== state.measureIds.length ||
        state.measureIds.some(id => !positive(id)) ||
        Object.keys(versions).length !== state.measureIds.length ||
        Object.entries(versions).some(
          ([id, version]) =>
            !/^[1-9][0-9]*$/.test(id) ||
            !positive(Number(id)) ||
            !positive(version) ||
            !state.measureIds.includes(Number(id)),
        )
      )
        throw new ConflictException('탐색 보기의 지표 연결을 확인할 수 없습니다.');
      if (
        state.measureIds.includes(row.id) ||
        Object.prototype.hasOwnProperty.call(versions, String(row.id))
      )
        exploreViews++;
    }
    for (const view of await m.find(PersonalView, { where: { sourceId: row.databaseId } })) {
      const state = this.parse(view.state);
      if (
        !Array.isArray(state.measureIds) ||
        !state.measureIds.length ||
        state.measureIds.some(id => !positive(id))
      )
        throw new ConflictException('개인 탐색 보기의 지표 연결을 확인할 수 없습니다.');
      if (state.measureIds.includes(row.id)) exploreViews++;
    }
    for (const job of await m.find(ExportJob, {
      where: [
        { sourceId: row.databaseId, status: 'queued' },
        { sourceId: row.databaseId, status: 'running' },
      ],
    })) {
      const request = this.parse(job.requestJson),
        basis = this.parse(job.basisJson);
      const ids = request.payload?.query?.measureIds;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.some(id => !positive(id)) ||
        !Array.isArray(basis.metrics) ||
        basis.metrics.some(ref => !positive(ref?.id))
      )
        throw new ConflictException('출력 작업의 지표 연결을 확인할 수 없습니다.');
      if (ids.includes(row.id) || basis.metrics.some(ref => ref.id === row.id)) exportJobs++;
    }
    return METRIC_DELETE_DEPENDENCY_KINDS.map(kind => ({
      kind,
      count: { dashboardDefinitions, studioDocuments, exploreViews, exportJobs }[kind],
    }));
  }
  async impact(value: unknown, actor: number, expectedEpoch = 0) {
    const id = this.id(value);
    return serializeMetadataWork(this.db, async () => {
      const org = await this.scope(actor, expectedEpoch, this.db.manager);
      const row = await this.owned(id, actor, this.db.manager);
      const dependencies = await this.dependencies(row, this.db.manager);
      const current = await this.owned(id, actor, this.db.manager);
      if (
        (await this.scope(actor, expectedEpoch, this.db.manager)) !== org ||
        metricDeletionRevision(current) !== metricDeletionRevision(row)
      )
        throw new ConflictException('삭제 기준이 변경되었습니다. 다시 확인해 주세요.');
      return {
        status: 'SUCCESS',
        data: {
          metricId: id,
          actorId: actor,
          organizationId: org,
          revision: metricDeletionRevision(row),
          canDelete: dependencies.every(item => item.count === 0),
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
  private receipt(row: MetricDeleteReceipt, replayed: boolean) {
    return {
      status: 'SUCCESS',
      data: {
        metricId: row.metricId,
        requestId: row.requestId,
        receiptId: row.id,
        deleted: true,
        replayed,
      },
    };
  }
  async remove(value: unknown, actor: number, body: unknown, expectedEpoch = 0) {
    const id = this.id(value),
      input = this.input(body);
    const digest = hash([
      id,
      input.expectedRevision,
      input.expectedActorId,
      input.expectedOrganizationId,
    ]);
    const run = async (m: EntityManager) => {
      const org = await this.scope(actor, expectedEpoch, m, true);
      if (input.expectedActorId !== actor || input.expectedOrganizationId !== org)
        throw new ConflictException(
          '계정 또는 조직이 변경되었습니다. 삭제 영향을 다시 확인해 주세요.',
        );
      const key = { actorId: actor, requestId: input.requestId };
      const prior = await m.findOneBy(MetricDeleteReceipt, key);
      if (prior) {
        if (prior.organizationId !== org || prior.digest !== digest)
          throw new ConflictException('같은 요청 번호의 삭제 기준이 다릅니다.');
        return this.receipt(prior, true);
      }
      const row = await this.owned(id, actor, m, true);
      if (metricDeletionRevision(row) !== input.expectedRevision)
        throw new ConflictException('저장 내용이 변경되었습니다. 삭제 영향을 다시 확인해 주세요.');
      const dependencies = await this.dependencies(row, m);
      if (dependencies.some(item => item.count > 0))
        throw new ConflictException(
          '사용처가 남아 있습니다. 저장 분석·Studio·탐색 보기의 연결을 명시 해제하고 삭제 영향을 다시 확인해 주세요.',
        );
      const removed = await m.update(
        Metric,
        { id, databaseId: row.databaseId, useYn: 'Y' },
        { useYn: 'N' },
      );
      if (removed.affected !== 1) throw new ConflictException('삭제할 지표가 변경되었습니다.');
      const saved = await m.save(MetricDeleteReceipt, {
        ...key,
        metricId: id,
        organizationId: org,
        expectedRevision: input.expectedRevision,
        digest,
      });
      if (org !== null)
        await m.insert(EnterpriseAuditEvent, {
          organizationId: org,
          actorId: actor,
          subjectId: actor,
          action: 'metric-deletion.completed',
          resourceId: saved.id,
          version: 1,
        });
      if ((await this.scope(actor, expectedEpoch, m)) !== org)
        throw new ConflictException('현재 조직이 변경되었습니다.');
      return this.receipt(saved, false);
    };
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
        throw new ConflictException(
          '삭제 요청이 경합 중입니다. 같은 요청으로 결과를 확인해 주세요.',
        );
      throw error;
    }
  }
}
