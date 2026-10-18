import { BadRequestException, ConflictException } from '@nestjs/common';
import { validateStudioDocument } from '../dashboard-studio/studio-document';
import { StudioBlock, StudioDocumentV1 } from '../dashboard-studio/studio-contract';
import { studioDigest } from '../dashboard-studio/studio-legacy';
import { canonicalMetricSql } from '../dashboard-studio/studio-remix-template';
import { validateExploreViewState } from './explore-view-state';
import { metricLinkItems } from '../ai/metric-analysis-links';
import { compatibleReuseColumn, remapDashboard, reuseColumns } from './dashboard-remap';
import {
  buildReuseMetricGraph,
  BiProfile,
  FrozenMetricReference,
  ReuseMetricGraph,
} from './reuse-metric-graph';
import type { CandidateMetricKey, PreparedSegmentInput } from './bi-segment-engine';
import type { AiDashboardService } from '../ai/ai-dashboard.service';
import type { BiExploreService } from './bi-explore.service';
type Analysis = Awaited<ReturnType<AiDashboardService['analysis']>>['data'];
type Catalog = Awaited<ReturnType<BiExploreService['catalog']>>;
type Entry = {
  block: StudioBlock;
  columns: string[];
  references: FrozenMetricReference[];
  item?: any;
  widget?: any;
  unsupportedReason?: string;
};
export type StudioReuseOrigin = {
  analysis: Analysis;
  snapshot: any;
  document: StudioDocumentV1;
  catalog: Catalog;
  profile: BiProfile;
  entries: Entry[];
  digest: string;
};
export type StudioReusePlan = {
  origin: StudioReuseOrigin;
  target: BiProfile;
  title: string;
  graph: ReuseMetricGraph;
  blocks: Array<{
    original: StudioBlock;
    chart?: any;
    metricKey?: CandidateMetricKey;
    pivot?: PreparedSegmentInput<CandidateMetricKey> & { measureKeys: CandidateMetricKey[] };
  }>;
  layouts: StudioDocumentV1['layouts'];
  draft: any;
  filters: any[];
  dateRange?: any;
  digest: string;
};
export type StudioReusePreviewBlock = {
  blockId: string;
  title: string;
  description: string;
  display: StudioBlock['display'];
} & (
  | { kind: 'SEGMENT_PIVOT'; pivot: any }
  | { kind: Exclude<StudioBlock['kind'], 'SEGMENT_PIVOT'>; widget: any }
);
export type StudioReusePreviewV1 = {
  schemaVersion: 1;
  kind: 'studio-reuse-preview';
  title: string;
  capturedAt: string;
  scope: string;
  blocks: StudioReusePreviewBlock[];
  layouts: StudioDocumentV1['layouts'];
  newMetricCount: number;
};
export type StudioReuseReadContext = {
  assertCurrent(): Promise<void>;
  query(sql: string, bindings: unknown[]): Promise<Record<string, any>[]>;
  previewCharts(draft: any): Promise<{ widgets: any[] }>;
};
const fail = () =>
  new BadRequestException(
    '복제할 저장본·열 연결을 확인해 주세요. 원본과 저장된 Pivot은 유지했습니다.',
  );
const stale = () =>
  new ConflictException('저장본 또는 Pivot 지표 기준이 변경되었습니다. 다시 불러와 주세요.');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const same = (a: any, b: any) => studioDigest(a) === studioDigest(b);
const fields = (d: any): string[] =>
  d.aggregation === 'FORMULA'
    ? d.formula.operands.flatMap(o => fields(o.definition))
    : ['column', 'denominatorColumn', 'weightColumn', 'defaultDateColumn']
        .map(k => d[k])
        .filter(v => typeof v === 'string' && v !== '*');
const rangeColumns = (value: any) => (value?.column ? [value.column] : []);
function unsupported(
  block: StudioBlock,
  refs: FrozenMetricReference[],
  document: StudioDocumentV1,
) {
  const hasBasis = (d: any): boolean =>
    d.businessBasis !== undefined || (d.formula?.operands ?? []).some(o => hasBasis(o.definition));
  return document.businessBasis ||
    block.businessBasis ||
    block.dimensionRefs.some(d => d.businessBasis) ||
    refs.some(r => hasBasis(r.definition))
    ? '고정 업무 의미가 있는 블록의 소스 교체는 아직 지원하지 않습니다. 이 블록을 제외하거나 원본을 유지하세요.'
    : undefined;
}
/** Metadata already read under owner/current-source authority; no SQL or writes in this function. */
export function captureStudioReuseOrigin(input: {
  analysis: Analysis;
  snapshot: any;
  document: StudioDocumentV1;
  catalog: Catalog;
  schemaVersion: string;
}): StudioReuseOrigin {
  const { analysis, snapshot, catalog, schemaVersion } = input;
  if (!input.document || !snapshot?.studioPivots?.length) throw fail();
  const document = validateStudioDocument(clone(input.document));
  if (
    document.sourceId !== analysis.databaseId ||
    document.sourceId !== catalog.sourceId ||
    document.revision !== analysis.revision ||
    document.title !== analysis.title ||
    snapshot.sourceId !== document.sourceId ||
    !same(
      snapshot.studioBlockOrder,
      document.blocks.map(b => b.id),
    ) ||
    !same(snapshot.studioLayouts, document.layouts) ||
    !same(snapshot.studioFilters ?? [], document.filters ?? []) ||
    !same(snapshot.studioDateRange ?? null, document.dateRange ?? null) ||
    !same(snapshot.studioConditions ?? null, document.conditions ?? null) ||
    !same(
      snapshot.studioPivots,
      document.blocks.filter(b => b.kind === 'SEGMENT_PIVOT'),
    )
  )
    throw stale();
  const charts = document.blocks.filter(b => b.kind !== 'SEGMENT_PIVOT');
  if (
    !charts.length ||
    charts.length !== analysis.widgets.length ||
    charts.some((b, i) => b.id !== analysis.widgets[i].blockId)
  )
    throw stale();
  const items = metricLinkItems(snapshot, analysis);
  if (items.length !== analysis.widgets.length) throw stale();
  const profile: any = {
    sourceId: catalog.sourceId,
    supported: true,
    dataVersion: catalog.sourceRevision,
    columns: catalog.dimensions.map(d => ({
      name: d.column,
      type: d.type,
      numeric: d.numeric,
      temporal: d.temporal,
    })),
  };
  const entries: Entry[] = document.blocks.map(block => {
    if (
      block.dimensionRefs.some(
        d => d.sourceId !== document.sourceId || d.schemaVersion !== schemaVersion,
      )
    )
      throw stale();
    if (block.kind === 'SEGMENT_PIVOT') {
      if (document.conditions) throw fail();
      if (block.pivot.revision !== catalog.viewRevision) throw stale();
      const state = validateExploreViewState(block.pivot.state, catalog);
      if (state.mode !== 'segment' || !state.segment?.pivotColumn || state.conditions !== undefined)
        throw fail();
      const refs = state.measureIds.map(id => {
        const m = catalog.measures.find(m => m.id === id);
        return { id, version: m.definitionVersion, definition: m.definition };
      });
      if (
        !same(
          block.measureRefs,
          refs.map(r => ({ id: r.id, definitionVersion: String(r.version) })),
        ) ||
        !same(
          block.dimensionRefs.map(d => d.key),
          [state.segment.dimensionColumn, state.segment.pivotColumn],
        )
      )
        throw stale();
      const columns = [
        state.segment.dimensionColumn,
        state.segment.pivotColumn,
        ...state.filters.map(f => f.column),
        ...rangeColumns(state.dateRange),
        ...refs.flatMap(r => fields(r.definition)),
        ...(catalog.temporalColumns[0] ? [catalog.temporalColumns[0].column] : []),
      ];
      return {
        block,
        references: refs,
        columns: [...new Set(columns)],
        unsupportedReason: unsupported(block, refs, document),
      };
    }
    const index = analysis.widgets.findIndex(w => w.blockId === block.id),
      widget = analysis.widgets[index],
      item = items[index];
    if (
      widget.type !== block.kind ||
      widget.title !== block.title ||
      (widget.description ?? '') !== block.description
    )
      throw stale();
    const refs: FrozenMetricReference[] =
      item.metricId === undefined
        ? []
        : [{ id: item.metricId, version: item.definitionVersion, definition: item.definition }];
    if (
      !same(
        block.measureRefs,
        refs.map(r => ({ id: r.id, definitionVersion: String(r.version) })),
      )
    )
      throw stale();
    if (
      refs.length &&
      (item.sourceId !== document.sourceId ||
        widget.sql !== canonicalMetricSql(item.definition, widget.type, item.dimension, profile))
    )
      throw stale();
    const columns = reuseColumns({ ...analysis, widgets: [widget] }, profile).map(c => c.name);
    if (typeof block.defaultDateColumn === 'string') columns.push(block.defaultDateColumn);
    return {
      block,
      widget,
      item,
      references: refs,
      columns: [...new Set(columns)],
      unsupportedReason: unsupported(block, refs, document),
    };
  });
  return {
    analysis: clone(analysis),
    snapshot: clone(snapshot),
    document,
    catalog: clone(catalog),
    profile,
    entries,
    digest: studioDigest([
      document,
      analysis,
      snapshot,
      catalog.viewRevision,
      catalog.sourceRevision,
    ]),
  };
}
export function prepareStudioReusePlan(
  origin: StudioReuseOrigin,
  target: BiProfile,
  input: { title: string; columnMap: Record<string, string>; blockIds: string[] },
): StudioReusePlan {
  if (
    !target.supported ||
    !Number.isSafeInteger(target.sourceId) ||
    !input.title?.trim() ||
    input.title.length > 300 ||
    !Array.isArray(input.blockIds) ||
    !input.blockIds.length ||
    new Set(input.blockIds).size !== input.blockIds.length ||
    input.blockIds.some(id => !origin.entries.some(e => e.block.id === id))
  )
    throw fail();
  const selected = origin.entries.filter(e => input.blockIds.includes(e.block.id));
  if (
    !selected.some(e => e.block.kind !== 'SEGMENT_PIVOT') ||
    selected.some(e => e.unsupportedReason)
  )
    throw fail();
  const commonNames = [
    ...(origin.document.filters ?? []).map(f => f.column),
    ...rangeColumns(origin.document.dateRange),
  ];
  const required = [...new Set([...selected.flatMap(e => e.columns), ...commonNames])];
  const allowed = new Set([...origin.entries.flatMap(e => e.columns), ...commonNames]);
  const map: Record<string, string> = Object.create(null);
  if (!input.columnMap || typeof input.columnMap !== 'object' || Array.isArray(input.columnMap))
    throw fail();
  for (const [name, to] of Object.entries(input.columnMap)) {
    if (!allowed.has(name)) throw fail();
    if (!required.includes(name)) continue;
    const from = origin.profile.columns.find(c => c.name === name),
      dest = target.columns.find(c => c.name === to);
    if (!from || !dest || !compatibleReuseColumn(from as any, dest as any)) throw fail();
    map[name] = dest.name;
  }
  if (required.some(n => !map[n])) throw fail();
  // Saved Explore recipes currently derive trend time from the first temporal column.
  // Reject a mapping that the persisted protocol cannot faithfully reproduce after reload.
  if (selected.some(e => e.block.kind === 'SEGMENT_PIVOT')) {
    const from = origin.catalog.temporalColumns[0]?.column;
    const to = target.columns.find(c => c.temporal)?.name;
    if ((from ? map[from] : undefined) !== to) throw fail();
  }
  const uniqueScope = (names: string[]) => {
    const mapped = [...new Set(names)].map(n => map[n]);
    if (new Set(mapped).size !== mapped.length) throw fail();
  };
  uniqueScope(commonNames);
  for (const e of selected)
    if (e.block.pivot) {
      const s = e.block.pivot.state;
      uniqueScope([
        s.segment.dimensionColumn,
        s.segment.pivotColumn,
        ...s.filters.map(f => f.column),
        ...rangeColumns(s.dateRange),
        ...commonNames,
      ]);
    }
  const graph = buildReuseMetricGraph({
    references: selected.flatMap(e => e.references),
    originalProfile: origin.profile,
    targetProfile: target,
    columnMap: map,
  });
  const keyFor = (id: number, version: number): CandidateMetricKey => {
    const n = graph.nodes.find(n => n.origin.id === id && n.origin.version === version);
    if (!n) throw fail();
    return n.key;
  };
  const filters = (origin.document.filters ?? []).map(f => ({
    ...clone(f),
    column: map[f.column],
  }));
  const dateRange = origin.document.dateRange
    ? { ...clone(origin.document.dateRange), column: map[origin.document.dateRange.column] }
    : undefined;
  const chartEntries = selected.filter(e => e.widget);
  const selectedAnalysis = {
    ...origin.analysis,
    widgets: chartEntries.map(e => e.widget),
    defaultFilters: origin.document.filters ?? [],
    ...(origin.document.dateRange ? { defaultDateRange: origin.document.dateRange } : {}),
  };
  const needed = reuseColumns(selectedAnalysis, origin.profile).map(c => c.name);
  const draft = remapDashboard(
    selectedAnalysis,
    origin.profile,
    target,
    Object.fromEntries(needed.map(n => [n, map[n]])),
  );
  draft.title = input.title.trim();
  const blocks = selected.map(e => {
    if (e.widget) {
      const w = draft.widgets[chartEntries.indexOf(e)];
      if (typeof e.block.defaultDateColumn === 'string')
        w.defaultDateColumn = map[e.block.defaultDateColumn];
      return {
        original: clone(e.block),
        chart: w,
        ...(e.references.length
          ? { metricKey: keyFor(e.references[0].id, e.references[0].version) }
          : {}),
      };
    }
    const s = e.block.pivot.state,
      measureKeys = s.measureIds.map(id =>
        keyFor(id, Number(e.block.measureRefs.find(r => r.id === id).definitionVersion)),
      );
    const localFilters = s.filters
      .filter(f => !origin.document.filters?.some(c => c.column === f.column))
      .map(f => ({ ...clone(f), column: map[f.column] }));
    const range =
      dateRange ??
      (s.dateRange ? { ...clone(s.dateRange), column: map[s.dateRange.column] } : undefined);
    return {
      original: clone(e.block),
      pivot: {
        measureKeys,
        measures: measureKeys.map(key => {
          const d = graph.nodes.find(n => n.key === key).definition;
          return {
            id: key,
            label: String(d.label),
            unit: typeof d.unit === 'string' ? d.unit : '',
            decimalPlaces: Number(d.decimalPlaces ?? 0),
            expression: '',
          };
        }),
        dimensionColumn: map[s.segment.dimensionColumn],
        pivotColumn: map[s.segment.pivotColumn],
        conditions: s.segment.conditions.map(c => ({
          ...c,
          measureId: measureKeys[s.measureIds.indexOf(c.measureId)],
        })),
        filters: [...localFilters, ...filters],
        ...(range ? { dateRange: range } : {}),
        trendGrain: s.trendGrain,
        trendColumn: origin.catalog.temporalColumns[0]
          ? map[origin.catalog.temporalColumns[0].column]
          : null,
        page: 0,
        pageSize: 20,
        aggregateOnly: true,
      },
    };
  });
  const layouts = Object.fromEntries(
    Object.entries(origin.document.layouts).map(([bp, rows]) => [
      bp,
      clone(rows.filter(r => input.blockIds.includes(r.id))),
    ]),
  ) as StudioDocumentV1['layouts'];
  const value = {
    origin,
    target: clone(target),
    title: draft.title,
    graph,
    blocks,
    layouts,
    draft,
    filters,
    ...(dateRange ? { dateRange } : {}),
  };
  return { ...value, digest: studioDigest(value) };
}
