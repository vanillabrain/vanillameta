import type { BusinessBasis } from '@/api/businessBasis';
import type { MetricBasisDefinition } from './StudioMetricBasis';
import { validDraft } from '../dashboardPreview';
import {
  studioAssert,
  studioClone,
  studioKeys,
  studioPositive,
  studioText,
  validateStudioDocument,
  validateStudioFilters,
  validateStudioDateRange,
  validateStudioConditions,
} from './studioDocument';
import {
  isTemporaryStudioId,
  StudioBlockKind,
  StudioBlock,
  StudioDimensionRef,
  StudioDisplay,
  StudioDocumentV1,
  StudioMeasureRef,
} from './studioTypes';

type LegacyWidget = {
  businessBasis?: BusinessBasis | null;
  defaultDateColumn?: string | null;
  blockId?: string;
  title: string;
  description: string;
  type: StudioBlockKind;
  sql: string;
  valueField: string;
  categoryField?: string;
} & StudioDisplay;
type LegacySize = { width: 6 | 12; height: 3 | 5 | 7 };
export type SavedMetricBasis = {
  sourceId: number;
  metricId: number;
  definitionVersion: string;
  definition: MetricBasisDefinition;
};
export type StudioDefinitions = {
  dashboardId: number;
  sourceId: number;
  revision: string;
  explanation: string;
  entries: Record<
    string,
    {
      widget?: LegacyWidget;
      pivot?: import('./studioPivot').StudioPivotRecipe;
      layoutSize?: LegacySize;
      metricBasis?: SavedMetricBasis;
    }
  >;
};
type Semantics = { measureRefs: StudioMeasureRef[]; dimensionRefs: StudioDimensionRef[] };
export type StudioImportResult = {
  document: StudioDocumentV1;
  definitions: StudioDefinitions;
  unresolvedReferences: string[];
};
const displayFields = ['decimalPlaces', 'numberNotation', 'prefix', 'suffix', 'timeGrain', 'presentation'] as const;
const optional = <T extends object>(value: T, keys: readonly string[]) =>
  Object.fromEntries(keys.filter(k => value[k] !== undefined).map(k => [k, value[k]]));

/** Owner-only projection from the analysis response, not the lossy editor catalog. No API calls. */
export function fromLegacyAnalysis(input: {
  dashboardId: number;
  analysis: unknown;
  semanticSnapshot?: Record<string, Semantics>;
  snapshot?: { studioPivots?: StudioBlock[]; studioLayouts?: StudioDocumentV1['layouts']; studioBlockOrder?: string[] };
}): StudioImportResult {
  studioPositive(input.dashboardId);
  const a = input.analysis as any;
  const pivotBlocks = input.snapshot?.studioPivots ?? [];
  studioAssert(
    Array.isArray(pivotBlocks) &&
      (validDraft(a) ||
        (pivotBlocks.length > 0 &&
          a &&
          Number.isSafeInteger(a.databaseId) &&
          a.databaseId > 0 &&
          typeof a.title === 'string' &&
          Array.isArray(a.widgets) &&
          a.widgets.length === 0)) &&
      a.widgets.length + pivotBlocks.length <= 6,
    '기존 분석 정의를 확인해 주세요.',
  );
  studioAssert(!a.studioPivots && !a.studioBlockOrder, 'Pivot snapshot을 별도로 확인해 주세요. 기존 정의는 유지됩니다.');
  studioText(a.explanation, 4000, true);
  studioAssert(typeof a.revision === 'string' && /^[a-f0-9]{64}$/.test(a.revision), '기존 분석 revision이 필요합니다.');
  studioAssert(
    a.blockLayouts && typeof a.blockLayouts === 'object' && !Array.isArray(a.blockLayouts),
    '기존 배치를 확인할 수 없습니다. 기존 편집 화면을 사용해 주세요.',
  );
  if (a.layoutSizes !== undefined)
    studioAssert(
      Array.isArray(a.layoutSizes) &&
        a.layoutSizes.length === a.widgets.length &&
        a.layoutSizes.every(s => s && [6, 12].includes(s.width) && [3, 5, 7].includes(s.height)),
      '기존 크기 정의를 확인해 주세요.',
    );
  const entries: StudioDefinitions['entries'] = {};
  const unresolvedReferences: string[] = [];
  // Server-owned structured definition scope arrives as an optional default, never as a user edit.
  const defaultFilters = a.defaultFilters === undefined ? undefined : validateStudioFilters(a.defaultFilters);
  const chartBlocks = a.widgets.map((w: any, index: number) => {
    const id = w.blockId ?? `legacy-${input.dashboardId}-${index}`;
    studioAssert(!isTemporaryStudioId(id), '저장된 블록 ID를 확인해 주세요.');
    const definitionKey = id;
    const semantic = input.semanticSnapshot?.[id];
    if (!semantic) unresolvedReferences.push(id);
    else studioKeys(semantic, ['measureRefs', 'dimensionRefs']);
    const widget: LegacyWidget = {
      ...optional(w, ['blockId', 'businessBasis', 'defaultDateColumn']),
      title: w.title,
      description: w.description,
      type: w.type,
      sql: w.sql,
      valueField: w.valueField,
      ...optional(w, ['categoryField', ...displayFields]),
    } as LegacyWidget;
    entries[definitionKey] = { widget, ...(a.layoutSizes ? { layoutSize: studioClone(a.layoutSizes[index]) } : {}) };
    return {
      id,
      ...optional(w, ['businessBasis', 'defaultDateColumn']),
      kind: w.type,
      definitionKey,
      title: w.title,
      description: w.description,
      measureRefs: semantic?.measureRefs ?? [],
      dimensionRefs: semantic?.dimensionRefs ?? [],
      display: optional(w, displayFields),
    };
  });
  const combined: StudioBlock[] = [...chartBlocks, ...studioClone(pivotBlocks)];
  const order = input.snapshot?.studioBlockOrder;
  studioAssert(
    !pivotBlocks.length ||
      (Array.isArray(order) &&
        order.length === combined.length &&
        new Set(order).size === combined.length &&
        combined.every(b => order.includes(b.id)) &&
        input.snapshot?.studioLayouts),
    'Pivot 순서와 배치를 확인해 주세요.',
  );
  const blocks: StudioBlock[] = order ? order.map(id => combined.find(b => b.id === id)) : combined;
  for (const block of pivotBlocks) {
    studioAssert(block.kind === 'SEGMENT_PIVOT' && !!block.pivot, 'Pivot snapshot을 확인해 주세요.');
    entries[block.definitionKey] = { pivot: studioClone(block.pivot) };
  }
  const ids = new Set<string>(blocks.map(b => b.id));
  studioAssert(
    Object.keys(a.blockLayouts).length === chartBlocks.length &&
      Object.keys(a.blockLayouts).every(id => chartBlocks.some(b => b.id === id)),
    '블록과 기존 배치가 일치하지 않습니다.',
  );
  if (input.semanticSnapshot)
    studioAssert(
      Object.keys(input.semanticSnapshot).every(id => ids.has(id)),
      '참조 snapshot의 블록이 없습니다.',
    );
  const lg = chartBlocks.map(b => {
    const g = a.blockLayouts[b.id];
    studioKeys(g, ['x', 'y', 'w', 'h']);
    return { id: b.id, x: g.x, y: g.y, w: g.w, h: g.h };
  });
  const sorted = [...lg].sort((l, r) => l.y - r.y || l.x - r.x);
  let mdY = 0,
    xsY = 0;
  const md = sorted.map(g => {
    const item = { ...g, x: 0, y: mdY, w: Math.min(8, Math.max(1, Math.ceil((g.w * 8) / 12))) };
    mdY += g.h;
    return item;
  });
  const xs = sorted.map(g => {
    const item = { ...g, x: 0, y: xsY, w: 1 };
    xsY += g.h;
    return item;
  });
  const document = validateStudioDocument({
    schemaVersion: 1,
    dashboardId: input.dashboardId,
    revision: a.revision,
    title: a.title,
    sourceId: a.databaseId,
    ...(Object.prototype.hasOwnProperty.call(a, 'businessBasis') ? { businessBasis: a.businessBasis } : {}),
    ...(defaultFilters?.length ? { filters: defaultFilters } : {}),
    ...(a.defaultDateRange !== undefined ? { dateRange: validateStudioDateRange(a.defaultDateRange) } : {}),
    ...(Object.prototype.hasOwnProperty.call(a, 'defaultConditions')
      ? { conditions: validateStudioConditions(a.defaultConditions) }
      : {}),
    blocks,
    layouts: input.snapshot?.studioLayouts ?? { lg, md, xs },
  });
  return {
    document,
    definitions: studioClone({
      dashboardId: input.dashboardId,
      sourceId: a.databaseId,
      revision: a.revision,
      explanation: a.explanation,
      entries,
    }),
    unresolvedReferences,
  };
}
/** Not a request body for /ai/dashboard-save: geometry and semantic preservation require the T4 server adapter. */
export function toLegacySave(document: StudioDocumentV1, definitions: StudioDefinitions, expectedRevision?: string) {
  const d = validateStudioDocument(document);
  const revision = expectedRevision ?? d.revision;
  studioAssert(
    typeof revision === 'string' && /^[a-f0-9]{64}$/.test(revision) && revision === definitions.revision,
    '원본 정의의 revision을 다시 확인해 주세요.',
  );
  studioAssert(
    d.dashboardId === definitions.dashboardId && d.sourceId === definitions.sourceId,
    '다른 소스의 정의를 저장할 수 없습니다.',
  );
  studioAssert(d.blocks.length > 0, '저장할 블록을 추가해 주세요.');
  const chartBlocks = d.blocks.filter(b => b.kind !== 'SEGMENT_PIVOT');
  studioAssert(chartBlocks.length > 0, '집계 Pivot은 일반 차트 하나 이상과 함께 저장해 주세요. 기존 문서는 유지됩니다.');
  const sizes = chartBlocks.map(b => definitions.entries[b.definitionKey]?.layoutSize);
  const widgets = chartBlocks.map((b): LegacyWidget => {
    const original = definitions.entries[b.definitionKey]?.widget;
    studioAssert(original && original.type === b.kind, '블록의 원본 정의를 확인해 주세요.');
    const widget = {
      type: original.type,
      sql: original.sql,
      valueField: original.valueField,
      ...optional(original, ['categoryField']),
    };
    return {
      ...studioClone(widget),
      ...studioClone(optional(b, ['businessBasis', 'defaultDateColumn'])),
      title: b.title,
      description: b.description,
      ...studioClone(b.display),
      ...(!isTemporaryStudioId(b.id) ? { blockId: b.id } : {}),
    };
  });
  return {
    requiresServerSnapshot: true as const,
    expectedRevision: revision,
    draft: {
      databaseId: d.sourceId,
      ...(Object.prototype.hasOwnProperty.call(d, 'businessBasis') ? { businessBasis: studioClone(d.businessBasis) } : {}),
      title: d.title,
      explanation: definitions.explanation,
      ...(sizes.every(Boolean) ? { layoutSizes: studioClone(sizes) } : {}),
      ...(d.filters ? { defaultFilters: studioClone(d.filters) } : {}),
      ...(d.dateRange ? { defaultDateRange: studioClone(d.dateRange) } : {}),
      ...(d.conditions ? { defaultConditions: studioClone(d.conditions) } : {}),
      widgets,
    },
    blockLayouts: studioClone(d.layouts),
    studioSnapshot: {
      studioPivots: studioClone(d.blocks.filter(b => b.kind === 'SEGMENT_PIVOT')),
      studioLayouts: studioClone(d.layouts),
      studioBlockOrder: d.blocks.map(b => b.id),
    },
    semanticRefs: Object.fromEntries(
      d.blocks.map(b => [b.id, { measureRefs: studioClone(b.measureRefs), dimensionRefs: studioClone(b.dimensionRefs) }]),
    ),
  };
}

export type StudioSaveProjection = ReturnType<typeof toLegacySave>;
