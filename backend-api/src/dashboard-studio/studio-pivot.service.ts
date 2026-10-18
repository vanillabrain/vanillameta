import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { BiExploreService } from '../bi/bi-explore.service';
import { BiSegmentService } from '../bi/bi-segment.service';
import { validateExploreViewState } from '../bi/explore-view-state';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { ConnectionService } from '../connection/connection.service';
import { StudioBlock, StudioDocumentV1 } from './studio-contract';
import { studioDigest } from './studio-legacy';
import { Metric } from '../metric/entities/metric.entity';

export const isStudioPivot = (block: StudioBlock) => block.kind === 'SEGMENT_PIVOT';
export const studioCharts = (document: StudioDocumentV1) =>
  document.blocks.filter(b => !isStudioPivot(b));
export const rejectPivotRemix = () =>
  new BadRequestException(
    'SEGMENT_PIVOT_UNSUPPORTED: Pivot은 같은 소스 비공개 복제만 지원합니다. 다른 소스·수신자 재사용은 지원하지 않습니다.',
  );

/** Aggregate-only projection. Explicit fields prevent private query recipes/raw rows entering previews. */
export function studioPivotResult(result: any, anonymous = false) {
  if (
    !result?.pivot ||
    !Array.isArray(result.kpis) ||
    result.kpis.length < 1 ||
    result.kpis.length > 6
  )
    throw new BadRequestException('안전한 Pivot 집계 결과를 확인해 주세요.');
  const ids = new Map(result.kpis.map((k: any, i: number) => [k.id, anonymous ? i + 1 : k.id]));
  const scalar = (v: any) => {
    if (
      v === null ||
      typeof v === 'string' ||
      typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v))
    )
      return v;
    throw new BadRequestException('Invalid Pivot aggregate scalar');
  };
  const numeric = (v: any) => {
    if (
      v === null ||
      (typeof v === 'number' && Number.isFinite(v)) ||
      (typeof v === 'string' &&
        v.length <= 128 &&
        /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v))
    )
      return v;
    throw new BadRequestException('Invalid Pivot aggregate value');
  };
  const values = (xs: any[]) =>
    xs.map(x => {
      if (!ids.has(x.id)) throw new BadRequestException('Unknown Pivot result measure');
      return { id: ids.get(x.id) as number, value: numeric(x.value) };
    });
  if (
    result.pivot.columnLimit !== 20 ||
    result.pivot.columns.length > 20 ||
    result.pivot.rows.length > 50 ||
    result.groups.length > 50
  )
    throw new BadRequestException('Invalid Pivot aggregate bounds');
  return {
    ...(!anonymous
      ? { sourceRevision: result.sourceRevision, viewRevision: result.viewRevision }
      : {}),
    scope: {
      dimensionColumn: String(result.scope.dimensionColumn),
      totalGroups: String(result.scope.totalGroups),
      rows: String(result.scope.rows),
    },
    kpis: result.kpis.map(k => ({
      id: ids.get(k.id) as number,
      label: String(k.label),
      value: numeric(k.value),
      unit: String(k.unit),
      decimalPlaces: k.decimalPlaces,
    })),
    groups: result.groups.map(g => ({ category: scalar(g.category), values: values(g.values) })),
    groupsTruncated: !!result.groupsTruncated,
    pivot: {
      column: String(result.pivot.column),
      columns: result.pivot.columns.map(c => ({
        value: scalar(c.value),
        totals: values(c.totals),
      })),
      rows: result.pivot.rows.map(r => ({
        category: scalar(r.category),
        cells: r.cells.map(c => ({ column: scalar(c.column), values: values(c.values) })),
      })),
      truncatedColumns: !!result.pivot.truncatedColumns,
      columnLimit: 20,
    },
    ...(result.trends
      ? {
          trends: result.trends.map(t => ({ time: String(t.time), values: values(t.values) })),
          trendsTruncated: !!result.trendsTruncated,
        }
      : {}),
  };
}

@Injectable()
export class StudioPivotService {
  constructor(
    private readonly db: DataSource,
    private readonly explore: BiExploreService,
    private readonly segments: BiSegmentService,
    private readonly access: SourceAccessService,
    private readonly connection: ConnectionService,
  ) {}
  async catalog(sourceId: number, actor: number) {
    await this.access.assert('database', sourceId, actor, 'owner');
    return this.explore.catalog({ sourceId }, actor);
  }
  canonical(recipe: any, catalog: any, schemaVersion: string) {
    if (recipe.revision !== catalog.viewRevision)
      throw new ConflictException(
        'Pivot 지표·열 정의가 변경되었습니다. 저장 보기를 갱신해 주세요.',
      );
    const state = validateExploreViewState(recipe.state, catalog);
    if (state.mode !== 'segment' || !state.segment?.pivotColumn || state.conditions !== undefined)
      throw new BadRequestException(
        'SEGMENT_PIVOT_UNSUPPORTED: 저장된 집계 Segment Pivot만 지원하며 행 AST 조건 조합은 지원하지 않습니다.',
      );
    return {
      measureRefs: state.measureIds.map(id => ({
        id,
        definitionVersion: String(catalog.measures.find(m => m.id === id).definitionVersion),
      })),
      dimensionRefs: [state.segment.dimensionColumn, state.segment.pivotColumn].map(key => ({
        key,
        sourceId: catalog.sourceId,
        schemaVersion,
      })),
      state,
    };
  }
  async validate(
    block: StudioBlock,
    sourceId: number,
    actor: number,
    schemaVersion: string,
    catalog?: any,
  ) {
    const current = catalog ?? (await this.catalog(sourceId, actor));
    const refs = this.canonical(block.pivot, current, schemaVersion);
    if (
      studioDigest(refs.measureRefs) !== studioDigest(block.measureRefs) ||
      studioDigest(refs.dimensionRefs) !== studioDigest(block.dimensionRefs) ||
      block.businessBasis !== undefined
    )
      throw new BadRequestException('Pivot의 실제 저장 지표·차원 참조를 유지해 주세요.');
    return { catalog: current, state: refs.state };
  }
  async assertSaved(block: StudioBlock, sourceId: number, actor: number) {
    const rows = await this.db.manager.find(PersonalView, { where: { sourceId, userId: actor } });
    if (
      !rows.some(row => {
        try {
          return (
            row.revision === block.pivot.revision &&
            studioDigest(JSON.parse(row.state)) === studioDigest(block.pivot.state)
          );
        } catch {
          return false;
        }
      })
    )
      throw new BadRequestException('본인의 유효한 저장 Segment Pivot 보기를 선택해 주세요.');
  }
  async locked(block: StudioBlock, sourceId: number, manager: EntityManager, catalog: any) {
    if (block.pivot.revision !== catalog.viewRevision)
      throw new ConflictException('Pivot 기준이 변경되었습니다. 다시 조회해 주세요.');
    for (const ref of block.measureRefs) {
      const row = await manager.findOne(Metric, {
        where: { id: ref.id, databaseId: sourceId, useYn: 'Y' },
      });
      const expected = catalog.measures.find(m => m.id === ref.id);
      if (
        !row ||
        !expected ||
        studioDigest(JSON.parse(row.definition)) !== studioDigest(expected.definition)
      )
        throw new ConflictException('Pivot 지표 정의가 변경되었습니다. 다시 조회해 주세요.');
    }
  }
  async options(sourceId: number, actor: number, schemaVersion: string) {
    const catalog = await this.catalog(sourceId, actor);
    const rows = await this.db.manager.find(PersonalView, {
      where: { sourceId, userId: actor },
      order: { id: 'DESC' },
      take: 20,
    });
    const options = [];
    for (const view of rows) {
      try {
        const recipe = { revision: view.revision, state: JSON.parse(view.state) };
        const refs = this.canonical(recipe, catalog, schemaVersion);
        const id = 'new:' + randomUUID();
        options.push({
          viewId: view.id,
          name: view.name,
          block: {
            id,
            kind: 'SEGMENT_PIVOT',
            definitionKey: 'pivot:' + randomUUID(),
            title: view.name,
            description: '',
            measureRefs: refs.measureRefs,
            dimensionRefs: refs.dimensionRefs,
            display: {},
            pivot: { revision: recipe.revision, state: refs.state },
          },
        });
      } catch (e) {
        if (
          !(
            e instanceof BadRequestException ||
            e instanceof ConflictException ||
            e instanceof SyntaxError
          )
        )
          throw e;
      }
    }
    return { options };
  }
  async preview(
    document: StudioDocumentV1,
    block: StudioBlock,
    actor: number,
    schemaVersion: string,
  ) {
    if (document.conditions)
      throw new BadRequestException(
        'SEGMENT_PIVOT_UNSUPPORTED: 공통 행 AST 조건과 Pivot의 집계 HAVING 조건 조합은 지원하지 않습니다.',
      );
    const { catalog, state } = await this.validate(block, document.sourceId, actor, schemaVersion);
    const filters = [
      ...state.filters.filter(f => !document.filters?.some(c => c.column === f.column)),
      ...(document.filters ?? []),
    ];
    const dateRange = document.dateRange ?? state.dateRange ?? undefined;
    const query = {
      sourceId: document.sourceId,
      sourceRevision: catalog.sourceRevision,
      catalogRevision: catalog.viewRevision,
      dimensionColumn: state.segment.dimensionColumn,
      pivotColumn: state.segment.pivotColumn,
      measureIds: state.measureIds,
      conditions: state.segment.conditions,
      filters,
      ...(dateRange ? { dateRange } : {}),
      trendGrain: state.trendGrain,
      page: 0,
      pageSize: 20,
    };
    const result = await this.segments.segments(query, actor, undefined, true);
    const fresh = await this.catalog(document.sourceId, actor);
    if (
      fresh.viewRevision !== catalog.viewRevision ||
      fresh.sourceRevision !== catalog.sourceRevision
    )
      throw new ConflictException('Pivot 기준이 변경되었습니다. 다시 조회해 주세요.');
    return {
      blockId: block.id,
      type: 'SEGMENT_PIVOT',
      title: block.title,
      description: block.description,
      pivot: studioPivotResult(result),
    };
  }
}
