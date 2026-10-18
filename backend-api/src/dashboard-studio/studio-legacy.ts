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
        ? [
            {
              key: item.dimension,
              sourceId: analysis.databaseId,
              schemaVersion,
              ...(item.dimensionBusinessBasis
                ? { businessBasis: item.dimensionBusinessBasis }
                : {}),
            },
          ]
        : [];
    return {
      id: w.blockId,
      definitionKey: w.blockId,
      kind: w.type,
      ...(w.businessBasis ? { businessBasis: w.businessBasis } : {}),
      ...(w.defaultDateColumn !== undefined ? { defaultDateColumn: w.defaultDateColumn } : {}),
      title: w.title,
      description: w.description,
      measureRefs,
      dimensionRefs,
      display: Object.fromEntries(
        ['decimalPlaces', 'numberNotation', 'prefix', 'suffix', 'timeGrain', 'presentation']
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
      // Derived layouts already stack every block; fill that row instead of leaving half blank.
      // Persisted width-specific layouts are read directly by StudioService and stay untouched.
      const n = { ...g, x: 0, y, w: cols };
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
    ...(analysis.businessBasis
      ? { businessBasis: analysis.businessBasis }
      : snapshot?.businessBasis
      ? { businessBasis: snapshot.businessBasis }
      : {}),
    ...(snapshot?.studioConditions !== undefined ? { conditions: snapshot.studioConditions } : {}),
    ...(snapshot?.studioFilters?.length ? { filters: snapshot.studioFilters } : {}),
    ...(snapshot?.studioDateRange ? { dateRange: snapshot.studioDateRange } : {}),
    blocks,
    layouts: { lg, md: derive(8), xs: derive(1) },
  });
}
function metricBasis(
  document: StudioDocumentV1,
  block: StudioBlock,
  widget: any,
  index: number,
  snapshot: any,
  analysis: any,
) {
  const item = metricLinkItems(snapshot, analysis)[index];
  const ref = block.measureRefs[0];
  if (
    !item ||
    widget?.blockId !== block.id ||
    (item.key !== undefined && item.key !== block.id) ||
    document.sourceId !== analysis.databaseId ||
    block.measureRefs.length !== 1 ||
    ref.id !== item.metricId ||
    ref.definitionVersion !== String(item.definitionVersion) ||
    !linkedMetricIndices(snapshot, analysis, ref.id).includes(index)
  )
    return undefined;
  const definition = Object.fromEntries(
    ['aggregation', 'column', 'denominatorColumn', 'weightColumn', 'scale', 'unit']
      .filter(key =>
        key === 'scale'
          ? typeof item.definition[key] === 'number' && Number.isFinite(item.definition[key])
          : typeof item.definition[key] === 'string',
      )
      .map(key => [key, item.definition[key]]),
  );
  return {
    sourceId: document.sourceId,
    metricId: ref.id,
    definitionVersion: ref.definitionVersion,
    definition,
  };
}
export function studioDefinitions(document: StudioDocumentV1, analysis: any, snapshot?: any) {
  return {
    dashboardId: document.dashboardId,
    sourceId: document.sourceId,
    revision: document.revision,
    explanation: analysis.explanation,
    entries: Object.fromEntries(
      document.blocks.map((b, i) => {
        const basis = metricBasis(document, b, analysis.widgets[i], i, snapshot, analysis);
        return [
          b.definitionKey,
          {
            widget: analysis.widgets[i],
            ...(basis ? { metricBasis: basis } : {}),
            ...(analysis.layoutSizes ? { layoutSize: analysis.layoutSizes[i] } : {}),
          },
        ];
      }),
    ),
  };
}
