import { serializeMetadataWork } from '../common/metadata-work';
import {
  latestConditionSemantics,
  resolveConditionSemantics,
  assertLatestConditionSemantics,
} from '../bi/business-condition-context';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { sourceWriteTransaction } from '../database/source-write-lock';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { SemanticRemixTemplate, conditionColumnNames } from './studio-remix-template';
import { Database } from '../database/entities/database.entity';
import { StudioRemixRequest } from './entities/studio-remix.entity';
import { StudioService } from './studio.service';
import { StudioCreationService } from './studio-creation.service';
import { StudioPublicationService } from './studio-publication.service';
import { studioDigest } from './studio-legacy';
import {
  compileConditionDefinition,
  conditionColumns,
  ConditionNode,
} from '../bi/source-condition-definition';
import { studioKeys, validateStudioConditions } from './studio-document';
import { StudioConditions, StudioDateRange, StudioFilter } from './studio-contract';
import {
  RemixField,
  RemixPreview,
  RemixPreviewRequest,
  RemixRequest,
  RemixRequirements,
  RemixTemplate,
} from './studio-remix-contract';
export type RemixOriginResolver = ((
  reference: string,
  actor: number,
  expectedVersion?: number,
  manager?: EntityManager,
) => Promise<{
  version: number;
  remixTemplate: string;
  lifecycleRevision: string;
  sourceId?: number;
}>) & {
  authorizeReceipt?: (reference: string, actor: number, manager?: EntityManager) => Promise<void>;
};
@Injectable()
export class StudioRemixService {
  constructor(
    private readonly db: DataSource,
    private readonly studio: StudioService,
    private readonly publications: StudioPublicationService,
    private readonly creation: StudioCreationService,
    private readonly dashboards: AiDashboardService,
    private readonly connection: ConnectionService,
    private readonly access: SourceAccessService,
  ) {}
  private requirements(
    token: string,
    version: number,
    t: RemixTemplate,
    lifecycleRevision: string,
  ): RemixRequirements {
    return {
      token,
      version,
      lifecycleRevision,
      title: t.title,
      filters: t.filters ?? [],
      ...(t.conditions !== undefined
        ? {
            conditions: (() => {
              const conditions = validateStudioConditions(t.conditions);
              return {
                ...conditions,
                ...(conditions.semantics
                  ? {
                      semantics: {
                        ...conditions.semantics,
                        columns: conditions.semantics.columns.filter(column =>
                          conditionColumnNames(conditions.definition).has(column.column),
                        ),
                      },
                    }
                  : {}),
              };
            })(),
          }
        : {}),
      ...(t.dateRange ? { dateRange: { ...t.dateRange } } : {}),
      requiredFields: t.requiredFields,
      blocks: t.blocks.map(({ id, title, kind, supported, reason }) => ({
        id,
        title,
        kind,
        supported,
        ...(reason ? { reason } : {}),
      })),
    };
  }
  async template(
    token: string,
    actor: number,
    origin: RemixOriginResolver = this.publications.requireRemix.bind(this.publications),
  ) {
    this.access.actor(actor);
    return this.studio.serializeWrite(async () => {
      const row = await origin(token, actor);
      await this.originSemantics(token, row, JSON.parse(row.remixTemplate));
      return this.requirements(
        token,
        row.version,
        JSON.parse(row.remixTemplate),
        row.lifecycleRevision,
      );
    });
  }
  private async originSemantics(
    token: string,
    row: { sourceId?: number },
    template: SemanticRemixTemplate,
    manager = this.db.manager,
  ) {
    if (template.conditions === undefined) return;
    const conditions = validateStudioConditions(template.conditions);
    if (!conditions.semantics) return;
    let sourceId = row.sourceId;
    // Received references were already authorized by their resolver. Read only server metadata;
    // never query the origin's private rows or expose its source/schema to the recipient.
    if (sourceId === undefined) {
      const received = /^[dg]-[1-9][0-9]*-[1-9][0-9]*-([1-9][0-9]*)-/.exec(token);
      if (received) {
        const dashboard = await manager.findOne(Dashboard, { where: { id: Number(received[1]) } });
        try {
          sourceId = JSON.parse(dashboard?.structuredDefinition).sourceId;
        } catch {
          /* fail closed below */
        }
      }
    }
    if (
      !Number.isSafeInteger(sourceId) ||
      sourceId <= 0 ||
      !Array.isArray(template.conditionSchema)
    )
      throw new ConflictException('원본 조건의 업무 기준 이력을 확인해 주세요.');
    const schema = template.conditionSchema;
    if (
      template.requiredFields.some(
        field => !schema.some(column => column.name === field.name && column.type === field.type),
      )
    )
      throw new ConflictException('원본 조건의 열 기준이 변경되었습니다.');
    await resolveConditionSemantics(manager, sourceId, schema, conditions.semantics);
  }

  private async currentTargetSemantics(
    sourceId: number,
    profile: any,
    mapped: { mappedConditions?: StudioConditions },
    manager = this.db.manager,
  ) {
    if (mapped.mappedConditions?.semantics)
      await assertLatestConditionSemantics(
        manager,
        sourceId,
        profile.columns,
        mapped.mappedConditions.semantics,
      );
  }

  private checkLifecycle(row: { lifecycleRevision: string }, expected: string) {
    if (row.lifecycleRevision !== expected)
      throw new ConflictException('원본 상태가 변경되었습니다. 복제 조건을 다시 확인해 주세요.');
  }
  private validate(body: any, save: boolean, legacyConfirmation = false): RemixRequest {
    try {
      (studioKeys as (value: any, keys: string[]) => void)(body, [
        ...(legacyConfirmation ? [] : ['expectedLifecycleRevision']),
        'targetSourceId',
        'mapping',
        'excludedBlockIds',
        'expectedVersion',
        ...(save ? ['requestId', 'expectedSourceRevision'] : []),
      ]);
      if (
        (!legacyConfirmation &&
          (typeof body.expectedLifecycleRevision !== 'string' ||
            !/^[a-f0-9]{64}$/.test(body.expectedLifecycleRevision))) ||
        !Number.isSafeInteger(body.targetSourceId) ||
        body.targetSourceId <= 0 ||
        !body.mapping ||
        typeof body.mapping !== 'object' ||
        Array.isArray(body.mapping) ||
        Object.keys(body.mapping).length > 128 ||
        Object.entries(body.mapping).some(
          ([k, v]) =>
            !k ||
            k.length > 256 ||
            ['__proto__', 'constructor', 'prototype'].includes(k) ||
            typeof v !== 'string' ||
            v.length > 256,
        ) ||
        (body.expectedVersion !== undefined &&
          (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1)) ||
        (body.excludedBlockIds !== undefined &&
          (!Array.isArray(body.excludedBlockIds) ||
            body.excludedBlockIds.length > 6 ||
            new Set(body.excludedBlockIds).size !== body.excludedBlockIds.length ||
            body.excludedBlockIds.some(id => typeof id !== 'string'))) ||
        (save &&
          (typeof body.requestId !== 'string' ||
            !/^[-a-zA-Z0-9_]{1,128}$/.test(body.requestId) ||
            body.expectedVersion === undefined ||
            typeof body.expectedSourceRevision !== 'string' ||
            !/^[a-f0-9]{64}$/.test(body.expectedSourceRevision)))
      )
        throw new Error();
      return {
        ...body,
        mapping: { ...body.mapping },
        excludedBlockIds: body.excludedBlockIds ?? [],
      };
    } catch {
      throw new BadRequestException('복제 요청과 기준 버전을 확인해 주세요.');
    }
  }
  private async map(t: RemixTemplate, body: RemixPreviewRequest, profile: any) {
    if (
      Object.keys(body.mapping).some(name => !t.requiredFields.some(f => f.name === name)) ||
      body.excludedBlockIds.some(id => !t.blocks.some(b => b.id === id))
    )
      throw new BadRequestException('알 수 없는 열 또는 제외 블록입니다.');
    const fields: RemixField[] = t.requiredFields.map(f => {
      const candidates = profile.columns.filter(c => c.type === f.type).map(c => c.name);
      const targetColumn = Object.prototype.hasOwnProperty.call(body.mapping, f.name)
        ? body.mapping[f.name]
        : profile.columns.find(c => c.name === f.name && c.type === f.type)?.name;
      const target = profile.columns.find(c => c.name === targetColumn);
      return {
        sourceColumn: f.name,
        sourceType: f.type,
        ...(targetColumn ? { targetColumn } : {}),
        candidates,
        status:
          targetColumn === ''
            ? 'missing'
            : targetColumn
            ? target?.type === f.type
              ? 'mapped'
              : 'incompatible'
            : candidates.length > 1
            ? 'ambiguous'
            : 'missing',
      };
    });
    const mapping = Object.fromEntries(
      fields
        .filter(f => f.status === 'mapped' || body.mapping[f.sourceColumn] === '')
        .map(f => [f.sourceColumn, f.targetColumn ?? '']),
    );
    const kept = t.blocks.filter(b => !body.excludedBlockIds.includes(b.id));
    // Scope columns move to the target names the mapping already authorized; an unmapped
    // scope column is reported instead of being applied partially.
    const filters: StudioFilter[] = [];
    const unmappedFilters: string[] = [];
    const scopeTargets = new Map<string, string>();
    for (const filter of t.filters ?? []) {
      const targetColumn = mapping[filter.column];
      if (targetColumn) {
        if (scopeTargets.has(targetColumn))
          throw new BadRequestException(
            `공통 필터 ${scopeTargets.get(targetColumn)}와 ${
              filter.column
            }을 같은 대상 열에 연결할 수 없습니다. 각 필터에 서로 다른 열을 선택해 주세요.`,
          );
        scopeTargets.set(targetColumn, filter.column);
        filters.push({ column: targetColumn, values: [...filter.values] });
      } else unmappedFilters.push(filter.column);
    }
    let mappedConditions: StudioConditions | undefined;
    const unmappedConditions: string[] = [];
    if (t.conditions !== undefined) {
      const stored = validateStudioConditions(t.conditions);
      // Private recipe retains the full snapshot; recipients see only fields used by this recipe.
      const originSemantics = stored.semantics
        ? {
            ...stored.semantics,
            columns: stored.semantics.columns.filter(column =>
              t.requiredFields.some(field => field.name === column.column),
            ),
          }
        : undefined;
      const used = conditionColumnNames(stored.definition);
      const usesBusinessMeaning = stored.semantics?.columns.some(column => used.has(column.column));
      const targetSemantics = usesBusinessMeaning
        ? await latestConditionSemantics(this.db.manager, body.targetSourceId, profile.columns)
        : undefined;
      const definition = compileConditionDefinition(
        stored.definition,
        conditionColumns(t.requiredFields, originSemantics),
        originSemantics,
      ).definition;
      const targets = new Map<string, string>();
      const visit = (node: ConditionNode | null): ConditionNode | null => {
        if (!node) return null;
        if (node.kind === 'group') return { ...node, children: node.children.map(visit) };
        const field = fields.find(f => f.sourceColumn === node.column);
        if (field?.status !== 'mapped') {
          if (!unmappedConditions.includes(node.column)) unmappedConditions.push(node.column);
          return node;
        }
        if (usesBusinessMeaning) {
          const from = stored.semantics.columns.find(column => column.column === node.column);
          const to = targetSemantics?.columns.find(column => column.column === field.targetColumn);
          if (
            (from?.businessType ?? 'auto') !== (to?.businessType ?? 'auto') ||
            (from?.dateFormat ?? '') !== (to?.dateFormat ?? '')
          )
            throw new BadRequestException(
              '대상 소스의 업무 유형·날짜 형식이 조건과 다릅니다. 대상 업무 정의를 준비한 뒤 다시 미리보기해 주세요.',
            );
          if (!targetSemantics)
            throw new BadRequestException(
              '대상 소스의 업무 정의를 확인한 뒤 다시 미리보기해 주세요.',
            );
        }
        const prior = targets.get(field.targetColumn);
        if (prior && prior !== node.column)
          throw new BadRequestException('서로 다른 조건 열을 같은 대상 열에 연결할 수 없습니다.');
        targets.set(field.targetColumn, node.column);
        return { ...node, column: field.targetColumn };
      };
      const mappedDefinition = {
        include: visit(definition.include),
        exclude: visit(definition.exclude),
      };
      if (!unmappedConditions.length)
        mappedConditions = {
          sourceRevision: stored.sourceRevision,
          ...(targetSemantics ? { semantics: targetSemantics } : {}),
          definition: compileConditionDefinition(
            mappedDefinition,
            conditionColumns(profile.columns, targetSemantics),
            targetSemantics,
          ).definition,
        };
    }
    const unmappedBlocks = kept.flatMap(block => {
      const missingFields = fields
        .filter(
          f =>
            f.status !== 'mapped' &&
            t.requiredFields.find(r => r.name === f.sourceColumn).blockIds.includes(block.id),
        )
        .map(f => f.sourceColumn);
      return !block.supported || missingFields.length
        ? [
            {
              blockId: block.id,
              title: block.title,
              reason: block.reason ?? '필수 열의 매핑과 타입을 확인해 주세요.',
              missingFields,
            },
          ]
        : [];
    });
    const blocks = kept
      .filter(b => !unmappedBlocks.some(u => u.blockId === b.id))
      .map(b => {
        const metric: any = {
          ...b.metric,
          schemaVersion: 1,
          definitionVersion: 1,
          sourceId: body.targetSourceId,
          tableName: 'uploaded_data',
        };
        for (const key of ['column', 'denominatorColumn', 'weightColumn'])
          if (metric[key] && !(key === 'column' && metric.aggregation === 'COUNT'))
            metric[key] = mapping[metric[key]];
        return {
          blockId: b.id,
          title: b.title,
          description: b.description,
          kind: b.kind,
          display: { ...b.display },
          metric,
          ...(b.dimension
            ? {
                dimension: {
                  column: mapping[b.dimension.column],
                  type: profile.columns.find(c => c.name === mapping[b.dimension.column]).type,
                  schemaVersion: profile.schemaVersion,
                },
              }
            : {}),
        };
      });
    // The published date scope only moves to a temporal target column the mapping authorized.
    const dateField = t.dateRange
      ? fields.find(f => f.sourceColumn === t.dateRange.column)
      : undefined;
    const dateTarget = dateField?.targetColumn
      ? profile.columns.find(c => c.name === dateField.targetColumn)
      : undefined;
    const mappedDateRange: StudioDateRange | undefined =
      t.dateRange && dateTarget?.temporal ? { ...t.dateRange, column: dateTarget.name } : undefined;
    const unmappedDateRange = t.dateRange && !mappedDateRange ? t.dateRange.column : undefined;
    return {
      fields,
      mapping,
      unmappedBlocks,
      blocks,
      kept,
      filters,
      unmappedFilters,
      mappedDateRange,
      unmappedDateRange,
      mappedConditions,
      unmappedConditions,
    };
  }
  private safePreview(preview: any) {
    return {
      widgets: preview.widgets.map(w => ({
        title: w.title,
        description: w.description,
        type: w.type,
        valueField: w.valueField,
        ...Object.fromEntries(
          ['prefix', 'suffix', 'decimalPlaces', 'numberNotation', 'timeGrain', 'presentation']
            .filter(key => w[key] !== undefined)
            .map(key => [key, w[key]]),
        ),
        ...(w.categoryField ? { categoryField: w.categoryField } : {}),
        fields: w.fields.map(f => ({ columnName: f.columnName, columnType: f.columnType })),
        datas: w.datas.map(row =>
          Object.fromEntries(
            [w.valueField, ...(w.categoryField ? [w.categoryField] : [])].map(key => [
              key,
              row[key],
            ]),
          ),
        ),
        ...(w.grainUnavailable ? { grainUnavailable: w.grainUnavailable } : {}),
        ...(w.trend
          ? {
              trend: {
                grain: w.trend.grain,
                points: w.trend.points.map(p => ({ time: p.time, value: p.value })),
              },
            }
          : {}),
      })),
    };
  }
  async preview(
    token: string,
    input: RemixPreviewRequest,
    actor: number,
    origin: RemixOriginResolver = this.publications.requireRemix.bind(this.publications),
  ): Promise<RemixPreview> {
    this.access.actor(actor);
    const body = this.validate(input, false);
    const initial = await this.studio.serializeWrite(async () => {
      const row = await origin(token, actor, body.expectedVersion);
      this.checkLifecycle(row, body.expectedLifecycleRevision);
      await this.access.assert('database', body.targetSourceId, actor);
      await this.originSemantics(token, row, JSON.parse(row.remixTemplate));
      return {
        row,
        identity: await this.sourceIdentity(body.targetSourceId, actor, this.db.manager),
      };
    });
    const row = initial.row;
    return this.connection.withDuckDBSnapshot(body.targetSourceId, async () => {
      const context: { profile?: any; mapped?: { mappedConditions?: StudioConditions } } = {};
      try {
        const profile = await this.creation.profile(body.targetSourceId, actor);
        context.profile = profile;
        await this.creation.ensureCurrentSource(body.targetSourceId, actor, this.db.manager);
        const t: RemixTemplate = JSON.parse(row.remixTemplate),
          mapped = await this.map(t, body, profile);
        context.mapped = mapped;
        if (mapped.mappedConditions)
          mapped.mappedConditions.sourceRevision = await this.connection.duckDBVersion(
            body.targetSourceId,
          );
        if (mapped.mappedConditions)
          await this.dashboards.assertConditionSemantics(
            body.targetSourceId,
            profile.columns,
            mapped.mappedConditions,
          );
        // Unmapped scope must never produce aggregates that look like the published scope applied.
        // A scope the target cannot apply must never produce aggregates that look scoped.
        const preview =
          mapped.blocks.length &&
          !mapped.unmappedFilters.length &&
          !mapped.unmappedDateRange &&
          !mapped.unmappedConditions.length
            ? this.safePreview(
                (
                  await this.dashboards.preview(
                    {
                      draft: this.creation.compile(
                        body.targetSourceId,
                        t.title,
                        mapped.blocks,
                        profile,
                      ),
                      filters: mapped.filters,
                      ...(mapped.mappedDateRange ? { dateRange: mapped.mappedDateRange } : {}),
                      ...(mapped.mappedConditions ? { conditions: mapped.mappedConditions } : {}),
                      includeTrends: true,
                    },
                    actor,
                  )
                ).data,
              )
            : undefined;
        await this.creation.ensureCurrentSource(body.targetSourceId, actor, this.db.manager);
        const latest = await this.creation.profile(body.targetSourceId, actor);
        if (
          latest.dataVersion !== profile.dataVersion ||
          latest.schemaVersion !== profile.schemaVersion
        )
          throw new ConflictException('대상 데이터가 변경되었습니다. 매핑을 다시 확인해 주세요.');
        await this.studio.serializeWrite(async () => {
          this.checkLifecycle(
            await origin(token, actor, row.version),
            body.expectedLifecycleRevision,
          );
          if (
            initial.identity !==
            (await this.sourceIdentity(body.targetSourceId, actor, this.db.manager))
          )
            throw new ConflictException('대상 소스가 변경되었습니다.');
          await this.originSemantics(token, row, t);
          await this.currentTargetSemantics(body.targetSourceId, profile, mapped);
        });
        return {
          ...this.requirements(token, row.version, t, row.lifecycleRevision),
          targetSourceId: body.targetSourceId,
          sourceRevision: profile.dataVersion,
          profile: {
            sourceId: profile.sourceId,
            name: profile.name,
            rowCount: profile.rowCount,
            dataVersion: profile.dataVersion,
            columns: profile.columns.map(({ name, type, numeric, temporal }) => ({
              name,
              type,
              numeric,
              temporal,
            })),
          },
          mapping: mapped.mapping,
          fields: mapped.fields,
          ...(mapped.mappedConditions ? { mappedConditions: mapped.mappedConditions } : {}),
          unmappedConditions: mapped.unmappedConditions,
          mappedFilters: mapped.filters,
          unmappedFilters: mapped.unmappedFilters,
          ...(mapped.mappedDateRange ? { mappedDateRange: mapped.mappedDateRange } : {}),
          ...(mapped.unmappedDateRange ? { unmappedDateRange: mapped.unmappedDateRange } : {}),
          unmappedBlocks: mapped.unmappedBlocks,
          ...(preview ? { preview } : {}),
        };
      } catch (error) {
        await this.guardComputation(token, actor, body, origin, initial, context);
        throw error;
      }
    });
  }
  private async guardComputation(
    token: string,
    actor: number,
    body: RemixPreviewRequest,
    origin: RemixOriginResolver,
    initial: { row: { version: number; remixTemplate: string }; identity: string },
    context: { profile?: any; mapped?: { mappedConditions?: StudioConditions } },
  ) {
    await serializeMetadataWork(this.db, async () => {
      const current = await origin(token, actor, initial.row.version, this.db.manager);
      this.checkLifecycle(current, body.expectedLifecycleRevision);
      if (current.remixTemplate !== initial.row.remixTemplate)
        throw new ConflictException('원본 조건이 변경되었습니다. 다시 미리보기해 주세요.');
      await this.access.assert('database', body.targetSourceId, actor, 'owner', this.db.manager);
      await this.originSemantics(token, current, JSON.parse(current.remixTemplate));
      if (context.profile && context.mapped)
        await this.currentTargetSemantics(body.targetSourceId, context.profile, context.mapped);
      // Read current metadata independently of the calculation's pinned file before any
      // computed error details (including invalid-date counts) can leave this request.
      if (
        initial.identity !==
        (await this.sourceIdentity(body.targetSourceId, actor, this.db.manager))
      )
        throw new ConflictException('대상 소스가 변경되었습니다.');
    });
  }
  private async sourceIdentity(sourceId: number, actor: number, manager: EntityManager) {
    return serializeMetadataWork(this.db, async () => {
      await this.creation.ensureCurrentSource(sourceId, actor, manager);
      await this.access.assert('database', sourceId, actor, 'read', manager);
      const row = await manager.findOne(Database, { where: { id: sourceId } });
      return studioDigest([
        row.id,
        row.ownerId,
        row.engine,
        row.connectionConfig,
        row.createdAt,
        row.updatedAt,
      ]);
    });
  }
  private async replay(
    token: string,
    actor: number,
    body: RemixRequest,
    payloadHash: string,
    origin: RemixOriginResolver,
    manager = this.db.manager,
  ) {
    const prior = await manager.findOne(StudioRemixRequest, {
      where: { actorId: actor, requestId: body.requestId },
    });
    if (!prior) return undefined;
    if (prior.payloadHash !== payloadHash)
      throw new ConflictException('같은 요청 ID에 다른 복제 내용을 보낼 수 없습니다.');
    if (origin.authorizeReceipt) await origin.authorizeReceipt(token, actor, manager);
    else await origin(token, actor, undefined, manager);
    const result = JSON.parse(prior.result);
    await this.access.dashboard(result.dashboardId, actor, 'owner', manager);
    return result;
  }
  async remix(
    token: string,
    input: RemixRequest,
    actor: number,
    origin: RemixOriginResolver = this.publications.requireRemix.bind(this.publications),
  ) {
    this.access.actor(actor);
    const legacyConfirmation =
      input && typeof input === 'object' && !('expectedLifecycleRevision' in input);
    const body = this.validate(input, true, legacyConfirmation),
      payloadHash = studioDigest({ token, ...body });
    const initial = await this.studio.serializeWrite(async () => {
      const result = await this.replay(token, actor, body, payloadHash, origin);
      if (result) return { result };
      await origin(token, actor);
      if (legacyConfirmation)
        throw new ConflictException('확정된 복제 기록이 없습니다. 복제 조건을 다시 확인해 주세요.');
      const row = await origin(token, actor, body.expectedVersion);
      this.checkLifecycle(row, body.expectedLifecycleRevision);
      await this.access.assert('database', body.targetSourceId, actor);
      const t: SemanticRemixTemplate = JSON.parse(row.remixTemplate);
      await this.originSemantics(token, row, t);
      return {
        row,
        t,
        identity: await this.sourceIdentity(body.targetSourceId, actor, this.db.manager),
      };
    });
    if ('result' in initial) return initial.result;
    return this.connection.withDuckDBSnapshot(body.targetSourceId, async () => {
      const context: { profile?: any; mapped?: { mappedConditions?: StudioConditions } } = {};
      try {
        const { row, t, identity } = initial;
        const profile = await this.creation.profile(body.targetSourceId, actor);
        context.profile = profile;
        if (profile.dataVersion !== body.expectedSourceRevision)
          throw new ConflictException('대상 데이터가 변경되었습니다. 매핑을 다시 확인해 주세요.');
        const mapped = await this.map(t, body, profile);
        context.mapped = mapped;
        if (mapped.mappedConditions) {
          mapped.mappedConditions.sourceRevision = await this.connection.duckDBVersion(
            body.targetSourceId,
          );
          // Full-source validation must finish before prepareSave and outside metadata coordination.
          await this.dashboards.assertConditionSemantics(
            body.targetSourceId,
            profile.columns,
            mapped.mappedConditions,
          );
        }
        if (mapped.unmappedConditions.length)
          throw new BadRequestException(
            '게시 포함·제외 조건의 모든 열을 대상 소스에 연결해 주세요.',
          );
        if (mapped.unmappedFilters.length)
          throw new BadRequestException('게시 범위 필터 열을 대상 소스 열로 매핑해 주세요.');
        if (mapped.unmappedDateRange)
          throw new BadRequestException(
            '게시 기간의 날짜 열을 대상 소스의 같은 형식 날짜 열로 매핑해 주세요.',
          );
        if (!mapped.kept.length || mapped.unmappedBlocks.length)
          throw new BadRequestException(
            '남길 블록의 모든 필수 열을 매핑하거나 해당 블록을 명시적으로 제외해 주세요.',
          );
        const preparation = await this.creation.prepareRemix(
          body.targetSourceId,
          t,
          mapped.blocks,
          profile,
          actor,
          mapped.filters,
          mapped.mappedDateRange,
          mapped.mappedConditions,
        );
        const latest = await this.creation.profile(body.targetSourceId, actor);
        if (
          latest.dataVersion !== body.expectedSourceRevision ||
          latest.schemaVersion !== profile.schemaVersion
        )
          throw new ConflictException('저장 중 대상 데이터가 변경되었습니다.');
        return await this.studio.serializeWrite(() =>
          sourceWriteTransaction(this.db, async manager => {
            const replayed = await this.replay(token, actor, body, payloadHash, origin, manager);
            if (replayed) return replayed;
            const check = async () => {
              const current = await origin(token, actor, body.expectedVersion, manager);
              this.checkLifecycle(current, body.expectedLifecycleRevision);
              if (current.remixTemplate !== row.remixTemplate)
                throw new ConflictException('원본 조건이 변경되었습니다. 다시 미리보기해 주세요.');
              await this.originSemantics(token, current, t, manager);
              await this.currentTargetSemantics(body.targetSourceId, profile, mapped, manager);
              if (identity !== (await this.sourceIdentity(body.targetSourceId, actor, manager)))
                throw new ConflictException('대상 소스가 변경되었습니다.');
            };
            await check();
            const result = await this.creation.persistRemix(manager, preparation);
            await check();
            await manager.insert(StudioRemixRequest, {
              actorId: actor,
              requestId: body.requestId,
              payloadHash,
              result: JSON.stringify(result),
            });
            return result;
          }),
        );
      } catch (error) {
        await this.guardComputation(token, actor, body, origin, initial, context);
        throw error;
      }
    });
  }
  /**
   * Execution recovery reads after pending transactions, so an uncommitted journal cannot escape.
   */
  async receipt(actor: number, requestId: string, sourceId: number) {
    this.access.actor(actor);
    if (
      typeof requestId !== 'string' ||
      !/^[-a-zA-Z0-9_]{1,128}$/.test(requestId) ||
      !Number.isSafeInteger(sourceId) ||
      sourceId <= 0
    )
      throw new BadRequestException('복제 완료 기록을 확인해 주세요.');
    return this.studio.serializeWrite(async () => {
      const row = await this.db.manager.findOne(StudioRemixRequest, {
        where: { actorId: actor, requestId },
      });
      if (!row) return undefined;
      let result: any;
      try {
        result = JSON.parse(row.result);
      } catch {
        throw new ConflictException('복제 완료 기록을 확인해 주세요.');
      }
      if (
        !Number.isSafeInteger(result?.dashboardId) ||
        result.dashboardId <= 0 ||
        result?.document?.dashboardId !== result.dashboardId ||
        result?.document?.sourceId !== sourceId ||
        typeof result?.document?.revision !== 'string' ||
        !/^[a-f0-9]{64}$/.test(result.document.revision)
      )
        throw new ConflictException('복제 완료 기록을 확인해 주세요.');
      // A receipt never outlives current access to the private clone and the target source.
      await this.access.dashboard(result.dashboardId, actor);
      await this.access.assert('database', sourceId, actor);
      return {
        dashboardId: result.dashboardId,
        sourceId,
        revision: result.document.revision,
        payloadHash: row.payloadHash,
      };
    });
  }
}
