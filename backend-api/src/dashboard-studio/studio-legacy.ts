import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { validateStudioDocument } from './studio-document';
import { StudioDocumentV1, StudioBlock } from './studio-contract';
import { linkedMetricIndices, metricLinkItems } from '../ai/metric-analysis-links';
export const studioDigest = (value: unknown): string => {
  const canonical = (v: any): any =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, canonical(v[k])]),
        )
      : v;
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
};
export function importStudio(
  id: number,
  analysis: any,
  snapshot: any,
  schemaVersion: string,
): StudioDocumentV1 {
  if (!analysis.blockLayouts)
    throw new BadRequestException(
      '기존 배치를 확인할 수 없습니다. 기존 편집 화면을 사용해 주세요.',
    );
  const items = metricLinkItems(snapshot, analysis);
  const blocks: StudioBlock[] = analysis.widgets.map((w: any, i: number) => {
    const item = items[i];
    if (
      item?.metricId !== undefined &&
      !linkedMetricIndices(snapshot, analysis, item.metricId).includes(i)
    )
      throw new BadRequestException('지표 연결 버전을 확인해 주세요.');
    const measureRefs =
      item?.metricId &&
      item.definition?.schemaVersion === 1 &&
      item.definition?.sourceId === analysis.databaseId &&
      item.definitionVersion === item.definition.definitionVersion
        ? [{ id: item.metricId, definitionVersion: String(item.definitionVersion) }]
        : [];
    const dimensionRefs =
      typeof item?.dimension === 'string'
        ? [{ key: item.dimension, sourceId: analysis.databaseId, schemaVersion }]
        : [];
    return {
      id: w.blockId,
      definitionKey: w.blockId,
      kind: w.type,
      title: w.title,
      description: w.description,
      measureRefs,
      dimensionRefs,
      display: Object.fromEntries(
        ['decimalPlaces', 'numberNotation', 'prefix', 'suffix', 'timeGrain']
          .filter(k => w[k] !== undefined)
          .map(k => [k, w[k]]),
      ),
    };
  });
  const lg = blocks.map(b => ({ id: b.id, ...analysis.blockLayouts[b.id] }));
  const sorted = [...lg].sort((a, b) => a.y - b.y || a.x - b.x);
  const derive = (cols: number) => {
    let y = 0;
    return sorted.map(g => {
      const n = { ...g, x: 0, y, w: Math.min(cols, Math.max(1, Math.ceil((g.w * cols) / 12))) };
      y += g.h;
      return n;
    });
  };
  return validateStudioDocument({
    schemaVersion: 1,
    dashboardId: id,
    revision: analysis.revision,
    title: analysis.title,
    sourceId: analysis.databaseId,
    ...(snapshot?.studioFilters?.length ? { filters: snapshot.studioFilters } : {}),
    ...(snapshot?.studioDateRange ? { dateRange: snapshot.studioDateRange } : {}),
    blocks,
    layouts: { lg, md: derive(8), xs: derive(1) },
  });
}
export function studioDefinitions(document: StudioDocumentV1, analysis: any) {
  return {
    dashboardId: document.dashboardId,
    sourceId: document.sourceId,
    revision: document.revision,
    explanation: analysis.explanation,
    entries: Object.fromEntries(
      document.blocks.map((b, i) => [
        b.definitionKey,
        {
          widget: analysis.widgets[i],
          ...(analysis.layoutSizes ? { layoutSize: analysis.layoutSizes[i] } : {}),
        },
      ]),
    ),
  };
}
