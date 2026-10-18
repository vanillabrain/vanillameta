import { EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { Metric } from '../metric/entities/metric.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { validateStudioDocument } from '../dashboard-studio/studio-document';
import { StudioDocumentV1 } from '../dashboard-studio/studio-contract';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { exploreViewRevision, validateExploreViewState } from './explore-view-state';
import { StudioReusePlan } from './studio-reuse-plan';
import { PersistedReuseMetrics } from './reuse-metric-graph';
export type SavedChartResult = {
  id: number;
  draft: any;
  blockIdMap: Record<string, string>;
  schemaVersion: string;
  sourceRevision: string;
};
/** Metadata only; caller holds actor/dashboard/source/metric fences and owns the receipt. */
export async function persistStudioReuse(
  plan: StudioReusePlan,
  metrics: PersistedReuseMetrics,
  saved: SavedChartResult,
  manager: EntityManager,
): Promise<{ id: number; revision: string; document: StudioDocumentV1 }> {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Studio reuse requires an active transaction.');
  const rows = await manager.find(Metric, {
    where: { databaseId: plan.target.sourceId, useYn: 'Y' },
  });
  const measures = rows
    .filter(r => r.definition)
    .map(r => {
      const definition = JSON.parse(r.definition);
      return {
        id: r.id,
        label: definition.label,
        definitionVersion: definition.definitionVersion,
        definition,
      };
    });
  const catalog = {
    sourceId: plan.target.sourceId,
    measures,
    dimensions: plan.target.columns.map(c => ({
      column: c.name,
      type: c.type,
      numeric: c.numeric,
      temporal: c.temporal,
    })),
    temporalColumns: plan.target.columns.filter(c => c.temporal).map(c => ({ column: c.name })),
  };
  const revision = exploreViewRevision(catalog),
    ids = { ...saved.blockIdMap };
  const get = (key: any) => {
    const row = metrics.get(key);
    if (!row) throw new BadRequestException('복제 지표가 누락되었습니다.');
    return row;
  };
  const blocks = plan.blocks.map(b => {
    const id = b.chart ? ids[b.original.id] : randomUUID();
    if (!id) throw new BadRequestException('복제 블록이 누락되었습니다.');
    ids[b.original.id] = id;
    const block: any = {
      ...JSON.parse(JSON.stringify(b.original)),
      id,
      definitionKey: id,
      dimensionRefs: b.original.dimensionRefs.map(d => ({
        key: plan.columnMap[d.key],
        sourceId: plan.target.sourceId,
        schemaVersion: saved.schemaVersion,
      })),
      measureRefs: b.metricKey ? [{ id: get(b.metricKey).id, definitionVersion: '1' }] : [],
    };
    if (typeof block.defaultDateColumn === 'string')
      block.defaultDateColumn = plan.columnMap[block.defaultDateColumn];
    if (b.pivot) {
      const state = JSON.parse(JSON.stringify(b.original.pivot.state));
      const byOld = new Map(
        b.original.pivot.state.measureIds.map((old, i) => [old, get(b.pivot.measureKeys[i]).id]),
      );
      state.measureIds = b.pivot.measureKeys.map(k => get(k).id);
      state.rankingMeasureId = byOld.get(state.rankingMeasureId);
      state.dimensionColumns = state.dimensionColumns.map(c => plan.columnMap[c]);
      state.segment = {
        ...state.segment,
        dimensionColumn: b.pivot.dimensionColumn,
        pivotColumn: b.pivot.pivotColumn,
        conditions: b.pivot.conditions.map(c => ({ ...c, measureId: get(c.measureId).id })),
      };
      state.filters = state.filters.map(f => ({ ...f, column: plan.columnMap[f.column] }));
      if (state.dateRange)
        state.dateRange = { ...state.dateRange, column: plan.columnMap[state.dateRange.column] };
      block.pivot = { revision, state: validateExploreViewState(state, catalog) };
      block.measureRefs = state.measureIds.map(id => ({ id, definitionVersion: '1' }));
    }
    return block;
  });
  const layouts = Object.fromEntries(
    Object.entries(plan.layouts).map(([bp, rects]) => [
      bp,
      rects.map(r => ({ ...r, id: ids[r.id] })),
    ]),
  ) as StudioDocumentV1['layouts'];
  const items = plan.blocks
    .filter(b => b.chart)
    .map(b => {
      if (!b.metricKey) return { key: ids[b.original.id] };
      const metric = get(b.metricKey),
        entry = plan.origin.entries.find(e => e.block.id === b.original.id).item;
      return {
        key: ids[b.original.id],
        sourceId: plan.target.sourceId,
        dataVersion: plan.target.dataVersion,
        metricId: metric.id,
        definitionVersion: 1,
        definition: metric.definition,
        ...(entry.dimension ? { dimension: plan.columnMap[entry.dimension] } : {}),
        chart: entry.chart,
      };
    });
  const row = await manager.findOneByOrFail(Dashboard, { id: saved.id });
  const snapshot = {
    schemaVersion: 2,
    studioSourceReuse: 1,
    kind: 'structured-bi-dashboard',
    sourceId: plan.target.sourceId,
    dataVersion: plan.target.dataVersion,
    items,
    ...(plan.filters.length ? { studioFilters: plan.filters } : {}),
    ...(plan.dateRange ? { studioDateRange: plan.dateRange } : {}),
    studioPivots: blocks.filter(b => b.kind === 'SEGMENT_PIVOT'),
    studioLayouts: layouts,
    studioBlockOrder: blocks.map(b => b.id),
  };
  row.structuredDefinition = JSON.stringify(snapshot);
  await manager.update(Dashboard, saved.id, { structuredDefinition: row.structuredDefinition });
  const finalRevision = dashboardRevision(row);
  const document = validateStudioDocument({
    schemaVersion: 1,
    dashboardId: saved.id,
    revision: finalRevision,
    title: plan.title,
    sourceId: plan.target.sourceId,
    blocks,
    layouts,
    ...(plan.filters.length ? { filters: plan.filters } : {}),
    ...(plan.dateRange ? { dateRange: plan.dateRange } : {}),
  });
  await manager.save(StudioState, {
    dashboardId: saved.id,
    legacyRevision: finalRevision,
    document: JSON.stringify({ document, sourceRevision: saved.sourceRevision }),
  });
  return { id: saved.id, revision: finalRevision, document };
}
