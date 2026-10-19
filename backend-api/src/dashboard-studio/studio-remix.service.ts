import {
  CatalogActorContext,
  catalogActorContext,
  assertCatalogActor,
} from '../bi/source-classifications';
import {
  BusinessBasis,
  captureBusinessBasis,
  resolveBusinessBasis,
  businessProfile,
  sliceBusinessBasis,
  assertBusinessBasisCurrent,
} from '../bi/semantic-business-basis';
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
import { lockSourceActor, sourceWriteTransaction } from '../database/source-write-lock';
import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { lockMetricSources } from '../metric/metric-write-lock';
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
    const conditions =
      template.conditions === undefined ? undefined : validateStudioConditions(template.conditions);
    const bases = template.blocks
      .flatMap(block => [
        block.businessBasis,
        block.metric?.businessBasis,
        block.dimension?.businessBasis,
      ])
      .filter(Boolean);
    if (!conditions?.semantics && !bases.length) return;
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
      (!Array.isArray(template.conditionSchema) && !Array.isArray(template.businessSchema))
    )
      throw new ConflictException('원본 조건의 업무 기준 이력을 확인해 주세요.');
    const schema = template.businessSchema ?? template.conditionSchema;
    if (
      template.requiredFields.some(
        field => !schema.some(column => column.name === field.name && column.type === field.type),
      )
    )
      throw new ConflictException('원본 조건의 열 기준이 변경되었습니다.');
    if (conditions?.semantics)
      await resolveConditionSemantics(
        manager,
        sourceId,
        template.conditionSchema ?? schema,
        conditions.semantics,
      );
    for (const block of template.blocks) {
      if (block.defaultDateColumn !== undefined && !block.businessBasis)
        throw new ConflictException('원본 추세의 고정 날짜 기준을 확인해 주세요.');
      if (block.businessBasis)
        await resolveBusinessBasis(
          manager,
          sourceId,
          { columns: schema },
          block.businessBasis,
          [
            block.metric?.aggregation === 'COUNT' ? undefined : block.metric?.column,
            block.metric?.denominatorColumn,
            block.metric?.weightColumn,
            block.dimension?.column,
            block.defaultDateColumn,
          ].filter(Boolean),
        );
      if (block.metric?.businessBasis)
        await resolveBusinessBasis(
          manager,
          sourceId,
          { columns: schema },
          block.metric.businessBasis,
          [
            block.metric.aggregation === 'COUNT' ? undefined : block.metric.column,
            block.metric.denominatorColumn,
            block.metric.weightColumn,
          ].filter(Boolean),
        );
      if (block.dimension?.businessBasis)
        await resolveBusinessBasis(
          manager,
          sourceId,
          { columns: schema },
          block.dimension.businessBasis,
          [block.dimension.column],
        );
    }
  }

  private async currentTargetSemantics(
    sourceId: number,
    profile: any,
    mapped: {
      mappedConditions?: StudioConditions;
      targetBusinessBasis?: BusinessBasis;
      businessBasisCaptured?: boolean;
      targetActorContext?: CatalogActorContext;
    },
    manager = this.db.manager,
  ) {
    if (mapped.targetActorContext) await assertCatalogActor(manager, mapped.targetActorContext);
    if (mapped.businessBasisCaptured)
      await assertBusinessBasisCurrent(manager, sourceId, profile, mapped.targetBusinessBasis);
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
  private usesBusinessBasis(t: RemixTemplate) {
    return t.blocks.some(
      b => b.businessBasis || b.metric?.businessBasis || b.dimension?.businessBasis,
    );
  }
  private async map(
    t: RemixTemplate,
    body: RemixPreviewRequest,
    profile: any,
    actor: number,
    capturedActor?: CatalogActorContext,
  ) {
    if (
      Object.keys(body.mapping).some(name => !t.requiredFields.some(f => f.name === name)) ||
      body.excludedBlockIds.some(id => !t.blocks.some(b => b.id === id))
    )
      throw new BadRequestException('알 수 없는 열 또는 제외 블록입니다.');
    const usesBusinessBasis = this.usesBusinessBasis(t);
    const targetBusinessBasis = usesBusinessBasis
      ? await captureBusinessBasis(this.db.manager, body.targetSourceId, profile)
      : undefined;
    const targetActorContext = usesBusinessBasis
      ? capturedActor ?? (await catalogActorContext(this.db.manager, actor))
      : undefined;
    const effective = businessProfile(profile, targetBusinessBasis);
    const compatibleMeaning = (name: string, target: string) => {
      if (!usesBusinessBasis) return true;
      const to = effective.columns.find(c => c.name === target);
      if (!to) return false;
      for (const block of t.blocks.filter(block => !body.excludedBlockIds.includes(block.id))) {
        const operands = block.metric
          ? [
              block.metric.aggregation === 'COUNT' ? undefined : block.metric.column,
              block.metric.denominatorColumn,
              block.metric.weightColumn,
            ].filter(Boolean)
          : [];
        const contexts = [
          ...(block.businessBasis?.columns.some(c => c.column === name)
            ? [block.businessBasis]
            : []),
          ...(operands.includes(name) ? [block.metric.businessBasis] : []),
          ...(block.dimension?.column === name ? [block.dimension.businessBasis] : []),
        ];
        for (const basis of contexts) {
          const from = basis?.columns.find(c => c.column === name);
          const native = t.requiredFields.find(f => f.name === name);
          const projected = businessProfile(
            {
              columns: [
                {
                  name,
                  type: native.type,
                  numeric:
                    /^(U?(BIGINT|INTEGER|SMALLINT|TINYINT)|HUGEINT|UHUGEINT|FLOAT|DOUBLE|DECIMAL)/i.test(
                      native.type,
                    ),
                  temporal: /^(DATE|TIMESTAMP)/i.test(native.type),
                },
              ],
            },
            undefined,
          ).columns[0];
          const meaning = (c: any, numeric: boolean, temporal: boolean) =>
            c?.businessType && c.businessType !== 'auto'
              ? c.businessType
              : temporal
              ? 'date'
              : numeric
              ? 'number'
              : 'category';
          const left = meaning(from, projected.numeric, projected.temporal),
            right = meaning(to, to.numeric, to.temporal);
          if (
            left !== right ||
            (left === 'date' && (from?.dateFormat || 'native') !== (to.dateFormat || 'native'))
          )
            return false;
        }
      }
      return true;
    };
    const fields: RemixField[] = t.requiredFields.map(f => {
      const candidates = profile.columns
        .filter(c => c.type === f.type && compatibleMeaning(f.name, c.name))
        .map(c => c.name);
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
            ? target?.type === f.type && compatibleMeaning(f.name, targetColumn)
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
        delete metric.businessBasis;
        for (const key of ['column', 'denominatorColumn', 'weightColumn'])
          if (metric[key] && !(key === 'column' && metric.aggregation === 'COUNT'))
            metric[key] = mapping[metric[key]];
        const metricColumns = [
          metric.aggregation === 'COUNT' ? undefined : metric.column,
          metric.denominatorColumn,
          metric.weightColumn,
        ].filter(Boolean);
        if (targetBusinessBasis)
          metric.businessBasis = sliceBusinessBasis(targetBusinessBasis, metricColumns);
        return {
          blockId: b.id,
          ...(targetBusinessBasis
            ? {
                businessBasis: sliceBusinessBasis(
                  targetBusinessBasis,
                  [
                    ...metricColumns,
                    b.dimension ? mapping[b.dimension.column] : undefined,
                    b.defaultDateColumn ? mapping[b.defaultDateColumn] : undefined,
                  ].filter(Boolean),
                ),
              }
            : {}),
          ...(b.defaultDateColumn !== undefined
            ? {
                defaultDateColumn:
                  b.defaultDateColumn === null ? null : mapping[b.defaultDateColumn],
              }
            : {}),
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
                  ...(targetBusinessBasis
                    ? {
                        businessBasis: sliceBusinessBasis(targetBusinessBasis, [
                          mapping[b.dimension.column],
                        ]),
                      }
                    : {}),
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
      targetBusinessBasis,
      targetActorContext,
      businessBasisCaptured: usesBusinessBasis,
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
    epoch = 0,
  ): Promise<RemixPreview> {
    this.access.actor(actor);
    const body = this.validate(input, false);
    await this.currentActor(actor, epoch);
    const initial = await this.studio.serializeWrite(async () => {
      const row = await origin(token, actor, body.expectedVersion);
      this.checkLifecycle(row, body.expectedLifecycleRevision);
      await this.access.assert('database', body.targetSourceId, actor);
      await this.originSemantics(token, row, JSON.parse(row.remixTemplate));
      return {
        row,
        identity: await this.sourceIdentity(body.targetSourceId, actor, this.db.manager),
        actorContext: this.usesBusinessBasis(JSON.parse(row.remixTemplate))
          ? await catalogActorContext(this.db.manager, actor)
          : undefined,
      };
    });
    const row = initial.row;
    return this.connection.withDuckDBSnapshot(body.targetSourceId, async () => {
      const context: {
        profile?: any;
        mapped?: {
          mappedConditions?: StudioConditions;
          targetBusinessBasis?: BusinessBasis;
          businessBasisCaptured?: boolean;
          targetActorContext?: CatalogActorContext;
        };
      } = {};
      try {
        const profile = await this.creation.profile(body.targetSourceId, actor);
        context.profile = profile;
        await this.creation.ensureCurrentSource(body.targetSourceId, actor, this.db.manager);
        const t: RemixTemplate = JSON.parse(row.remixTemplate),
          mapped = await this.map(t, body, profile, actor, initial.actorContext);
        context.mapped = mapped;
        await this.creation.validateBusinessDates(
          mapped.blocks,
          profile,
          mapped.targetBusinessBasis,
        );
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
                        mapped.targetBusinessBasis,
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
        await this.currentActor(actor, epoch);
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
        await this.currentActor(actor, epoch);
        try {
          await this.guardComputation(token, actor, body, origin, initial, context);
        } finally {
          await this.currentActor(actor, epoch);
        }
        throw error;
      }
    });
  }
  private async guardComputation(
    token: string,
    actor: number,
    body: RemixPreviewRequest,
    origin: RemixOriginResolver,
    initial: {
      row: { version: number; remixTemplate: string };
      identity: string;
      actorContext?: CatalogActorContext;
    },
    context: {
      profile?: any;
      mapped?: {
        mappedConditions?: StudioConditions;
        targetBusinessBasis?: BusinessBasis;
        businessBasisCaptured?: boolean;
        targetActorContext?: CatalogActorContext;
      };
    },
  ) {
    await serializeMetadataWork(this.db, async () => {
      if (initial.actorContext) await assertCatalogActor(this.db.manager, initial.actorContext);
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
    epoch = 0,
  ) {
    this.access.actor(actor);
    const legacyConfirmation =
      input && typeof input === 'object' && !('expectedLifecycleRevision' in input);
    const body = this.validate(input, true, legacyConfirmation),
      payloadHash = studioDigest({ token, ...body });
    const confirmed = await this.studio.serializeWrite(() =>
      sourceWriteTransaction(this.db, async manager => {
        await lockSourceActor(manager, actor, epoch);
        return this.replay(token, actor, body, payloadHash, origin, manager);
      }),
    );
    if (confirmed) return confirmed;
    const initial = await this.studio.serializeWrite(async () => {
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
        actorContext: this.usesBusinessBasis(JSON.parse(row.remixTemplate))
          ? await catalogActorContext(this.db.manager, actor)
          : undefined,
      };
    });
    return this.connection.withDuckDBSnapshot(body.targetSourceId, async () => {
      const context: {
        profile?: any;
        mapped?: {
          mappedConditions?: StudioConditions;
          targetBusinessBasis?: BusinessBasis;
          businessBasisCaptured?: boolean;
          targetActorContext?: CatalogActorContext;
        };
      } = {};
      try {
        const { row, t, identity } = initial;
        const profile = await this.creation.profile(body.targetSourceId, actor);
        context.profile = profile;
        if (profile.dataVersion !== body.expectedSourceRevision)
          throw new ConflictException('대상 데이터가 변경되었습니다. 매핑을 다시 확인해 주세요.');
        const mapped = await this.map(t, body, profile, actor, initial.actorContext);
        context.mapped = mapped;
        await this.creation.validateBusinessDates(
          mapped.blocks,
          profile,
          mapped.targetBusinessBasis,
        );
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
          mapped.targetBusinessBasis,
        );
        const latest = await this.creation.profile(body.targetSourceId, actor);
        if (
          latest.dataVersion !== body.expectedSourceRevision ||
          latest.schemaVersion !== profile.schemaVersion
        )
          throw new ConflictException('저장 중 대상 데이터가 변경되었습니다.');
        return await this.studio.serializeWrite(() =>
          sourceWriteTransaction(this.db, async manager => {
            await lockSourceActor(manager, actor, epoch);
            if (mapped.targetActorContext)
              await assertCatalogActor(manager, mapped.targetActorContext, true);
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
        await this.currentActor(actor, epoch);
        try {
          await this.guardComputation(token, actor, body, origin, initial, context);
        } finally {
          await this.currentActor(actor, epoch);
        }
        throw error;
      }
    });
  }
  private currentActor(actor: number, epoch: number) {
    return this.studio.serializeWrite(() =>
      sourceWriteTransaction(this.db, manager => lockSourceActor(manager, actor, epoch)),
    );
  }
  private privateReference(token: unknown) {
    const direct =
      typeof token === 'string' &&
      /^d-([1-9][0-9]*)-([1-9][0-9]*)-([1-9][0-9]*)-([1-9][0-9]*)-([a-f0-9]{64})$/.exec(token);
    const grouped =
      typeof token === 'string' &&
      /^g-([1-9][0-9]*)-([1-9][0-9]*)-([1-9][0-9]*)-([1-9][0-9]*)-([1-9][0-9]*)-([1-9][0-9]*)-([a-f0-9]{64})$/.exec(
        token,
      );
    const parsed = direct || grouped;
    if (!parsed || parsed.slice(1, -1).some(v => !Number.isSafeInteger(Number(v))))
      throw new BadRequestException('받은 자료 복제 기준을 확인해 주세요.');
  }
  /** Read-only confirmation of an exact committed private copy, independent of current origin sharing. */
  async receivedResult(token: string, input: RemixRequest, actor: number, epoch = 0) {
    this.privateReference(token);
    const body = this.validate(input, true),
      payloadHash = studioDigest({ token, ...body });
    return this.studio.serializeWrite(() =>
      sourceWriteTransaction(this.db, async manager => {
        await lockSourceActor(manager, actor, epoch);
        const row = await manager.findOne(StudioRemixRequest, {
          where: { actorId: actor, requestId: body.requestId },
        });
        if (!row) {
          await lockMetricSources(manager, [body.targetSourceId]);
          await this.access.assert('database', body.targetSourceId, actor, 'owner', manager);
          return { found: false as const };
        }
        if (row.payloadHash !== payloadHash)
          throw new ConflictException('같은 요청 ID의 복제 내용이 다릅니다.');
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
          result?.document?.sourceId !== body.targetSourceId ||
          typeof result?.document?.revision !== 'string' ||
          !/^[a-f0-9]{64}$/.test(result.document.revision)
        )
          throw new ConflictException('복제 완료 기록을 확인해 주세요.');
        await lockDashboardWrite(manager, result.dashboardId);
        await lockMetricSources(manager, [body.targetSourceId]);
        await this.access.dashboard(result.dashboardId, actor, 'owner', manager);
        await this.access.assert('database', body.targetSourceId, actor, 'owner', manager);
        return {
          found: true as const,
          dashboardId: result.dashboardId as number,
          sourceId: body.targetSourceId,
          revision: result.document.revision as string,
        };
      }),
    );
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
