import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { sourceWriteTransaction } from '../database/source-write-lock';
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
) => Promise<{ version: number; remixTemplate: string; lifecycleRevision: string }>) & {
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
      ...(t.conditions !== undefined ? { conditions: validateStudioConditions(t.conditions) } : {}),
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
      return this.requirements(
        token,
        row.version,
        JSON.parse(row.remixTemplate),
        row.lifecycleRevision,
      );
    });
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
  private map(t: RemixTemplate, body: RemixPreviewRequest, profile: any) {
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
      const definition = compileConditionDefinition(
        stored.definition,
        conditionColumns(t.requiredFields),
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
          definition: compileConditionDefinition(
            mappedDefinition,
            conditionColumns(profile.columns),
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
          ['prefix', 'suffix', 'decimalPlaces', 'numberNotation', 'timeGrain']
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
    return this.studio.serializeWrite(async () => {
      const row = await origin(token, actor, body.expectedVersion);
      this.checkLifecycle(row, body.expectedLifecycleRevision);
      await this.access.assert('database', body.targetSourceId, actor);
      return this.connection.withDuckDBSnapshot(body.targetSourceId, async () => {
        const profile = await this.creation.profile(body.targetSourceId, actor);
        await this.creation.ensureCurrentSource(body.targetSourceId, actor, this.db.manager);
        const t: RemixTemplate = JSON.parse(row.remixTemplate),
          mapped = this.map(t, body, profile);
        if (mapped.mappedConditions)
          mapped.mappedConditions.sourceRevision = await this.connection.duckDBVersion(
            body.targetSourceId,
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
        this.checkLifecycle(
          await origin(token, actor, row.version),
          body.expectedLifecycleRevision,
        );
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
      });
    });
  }
  private async sourceIdentity(sourceId: number, actor: number, manager: EntityManager) {
    await this.creation.ensureCurrentSource(sourceId, actor, manager);
    const row = await manager.findOne(Database, { where: { id: sourceId } });
    return studioDigest([
      row.id,
      row.ownerId,
      row.engine,
      row.connectionConfig,
      row.createdAt,
      row.updatedAt,
    ]);
  }
  async remix(
    token: string,
    input: RemixRequest,
    actor: number,
    origin: RemixOriginResolver = this.publications.requireRemix.bind(this.publications),
  ) {
    this.access.actor(actor);
    // Cached old clients may only confirm an already committed exact legacy receipt.
    // This branch never supplies a lifecycle proof or authorizes a new copy.
    const legacyConfirmation =
      input && typeof input === 'object' && !('expectedLifecycleRevision' in input);
    const body = this.validate(input, true, legacyConfirmation),
      payloadHash = studioDigest({ token, ...body });
    return this.studio.serializeWrite(async () => {
      const prior = await this.db.manager.findOne(StudioRemixRequest, {
        where: { actorId: actor, requestId: body.requestId },
      });
      if (prior) {
        if (prior.payloadHash !== payloadHash)
          throw new ConflictException('같은 요청 ID에 다른 복제 내용을 보낼 수 없습니다.');
        // Historical confirmation requires current authority, not a still-current preparation fingerprint.
        if (origin.authorizeReceipt) await origin.authorizeReceipt(token, actor, this.db.manager);
        else await origin(token, actor);
        const result = JSON.parse(prior.result);
        await this.access.dashboard(result.dashboardId, actor);
        return result;
      }
      await origin(token, actor);
      if (legacyConfirmation)
        throw new ConflictException('확정된 복제 기록이 없습니다. 복제 조건을 다시 확인해 주세요.');
      this.checkLifecycle(
        await origin(token, actor, body.expectedVersion),
        body.expectedLifecycleRevision,
      );
      await this.access.assert('database', body.targetSourceId, actor);
      return this.connection.withDuckDBSnapshot(body.targetSourceId, async () => {
        const profile = await this.creation.profile(body.targetSourceId, actor);
        if (profile.dataVersion !== body.expectedSourceRevision)
          throw new ConflictException('대상 데이터가 변경되었습니다. 매핑을 다시 확인해 주세요.');
        const identity = await this.sourceIdentity(body.targetSourceId, actor, this.db.manager);
        const row = await origin(token, actor, body.expectedVersion);
        this.checkLifecycle(row, body.expectedLifecycleRevision);
        const t: RemixTemplate = JSON.parse(row.remixTemplate),
          mapped = this.map(t, body, profile);
        if (mapped.mappedConditions)
          mapped.mappedConditions.sourceRevision = await this.connection.duckDBVersion(
            body.targetSourceId,
          );
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
        return sourceWriteTransaction(this.db, async manager => {
          this.checkLifecycle(
            await origin(token, actor, body.expectedVersion, manager),
            body.expectedLifecycleRevision,
          );
          if (identity !== (await this.sourceIdentity(body.targetSourceId, actor, manager)))
            throw new ConflictException('대상 소스가 변경되었습니다.');
          const result = await this.creation.persistRemix(manager, preparation);
          // Recheck after save/aggregate awaits, including legacy metadata writes outside Studio's queue.
          this.checkLifecycle(
            await origin(token, actor, body.expectedVersion, manager),
            body.expectedLifecycleRevision,
          );
          if (identity !== (await this.sourceIdentity(body.targetSourceId, actor, manager)))
            throw new ConflictException('저장 중 대상 데이터가 변경되었습니다.');
          await manager.insert(StudioRemixRequest, {
            actorId: actor,
            requestId: body.requestId,
            payloadHash,
            result: JSON.stringify(result),
          });
          return result;
        });
      });
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
