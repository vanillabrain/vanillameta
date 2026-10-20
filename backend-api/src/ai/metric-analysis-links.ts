import { DashboardDraft } from './dashboard-draft';

/** Persist keys only after save has assigned final block UUIDs, including copied blocks. */
export function bindMetricBlockKeys(snapshot: any, draft: DashboardDraft) {
  if (
    snapshot?.schemaVersion !== 2 ||
    snapshot.kind !== 'structured-bi-dashboard' ||
    !Array.isArray(snapshot.items)
  )
    return snapshot;
  return {
    ...snapshot,
    items: snapshot.items.map((item, i) => ({
      ...item,
      key: draft.widgets[i]?.blockId ?? item.key,
    })),
  };
}

export function metricLinkItems(snapshot: any, draft: DashboardDraft): any[] {
  if (!snapshot || snapshot.sourceId !== draft.databaseId) return [];
  if (snapshot.schemaVersion === 1 && snapshot.kind === 'structured-bi') return [snapshot];
  if (
    (snapshot.schemaVersion === 2 && snapshot.kind === 'structured-bi-dashboard') ||
    (snapshot.schemaVersion === 1 && snapshot.kind === 'metric-linked-analysis')
  )
    return Array.isArray(snapshot.items) ? snapshot.items : [];
  return [];
}
/** UC-004: explicit source-bound stored references; never infer from SQL/labels. */
export function linkedMetricIndices(snapshot: any, draft: DashboardDraft, metricId: number) {
  return metricLinkItems(snapshot, draft).flatMap((item, index) =>
    index < draft.widgets.length &&
    item?.metricId === metricId &&
    (item.sourceId ?? item.definition?.sourceId) === draft.databaseId &&
    item.definition?.schemaVersion === 1 &&
    item.definition.sourceId === draft.databaseId &&
    item.definition.definitionVersion === item.definitionVersion &&
    Number.isSafeInteger(item.definitionVersion) &&
    item.definitionVersion > 0
      ? [index]
      : [],
  );
}
/** Carry only trusted persisted links whose block identity and calculation still match. */
export function preserveMetricLinks(snapshot: any, previous: DashboardDraft, next: DashboardDraft) {
  if (!previous || previous.databaseId !== next.databaseId) return null;
  const items = metricLinkItems(snapshot, previous);
  if (!items.length || items.length !== previous.widgets.length) return null;
  const blocks = new Map(
    previous.widgets.map((widget, index) => [widget.blockId, { widget, index }]),
  );
  const preserved = next.widgets.map(widget => {
    const original = blocks.get(widget.blockId);
    if (!original || !widget.blockId) return {};
    const item = items[original.index];
    if (
      !item ||
      (items.length > 1 && !item.key) ||
      (item.key && item.key !== original.widget.blockId) ||
      (item.metricId !== undefined &&
        !linkedMetricIndices(snapshot, previous, item.metricId).includes(original.index)) ||
      ['sql', 'valueField', 'categoryField', 'type'].some(
        field => widget[field] !== original.widget[field],
      )
    )
      return {};
    return { ...item };
  });
  if (!preserved.some(item => Object.keys(item).length)) return null;
  if (snapshot.kind === 'structured-bi' && preserved.length === 1) return { ...snapshot };
  if (snapshot.kind === 'structured-bi' || snapshot.kind === 'metric-linked-analysis')
    return {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: next.databaseId,
      dataVersion: snapshot.dataVersion,
      items: preserved,
    };
  return { ...snapshot, items: preserved };
}

export function refreshMetricLinks(
  snapshot: any,
  draft: DashboardDraft,
  indices: number[],
  metricId: number,
  definition: any,
) {
  const items = metricLinkItems(snapshot, draft);
  const linked = linkedMetricIndices(snapshot, draft, metricId);
  const update = item => ({
    ...item,
    sourceId: draft.databaseId,
    metricId,
    definitionVersion: definition.definitionVersion,
    definition,
  });
  if (
    snapshot?.kind === 'structured-bi' &&
    indices.length === 1 &&
    indices[0] === 0 &&
    linked.includes(0)
  )
    return update(snapshot);
  const next = draft.widgets.map((_, i) =>
    indices.includes(i) ? update(items[i] || {}) : items[i] || {},
  );
  if (snapshot?.kind === 'structured-bi-dashboard' && indices.every(i => linked.includes(i)))
    return { ...snapshot, items: next };
  return {
    schemaVersion: 1,
    kind: 'metric-linked-analysis',
    ...(snapshot?.sourceId === draft.databaseId && snapshot?.studioFilters
      ? { studioFilters: snapshot.studioFilters }
      : {}),
    ...(snapshot?.sourceId === draft.databaseId && snapshot?.studioDateRange
      ? { studioDateRange: snapshot.studioDateRange }
      : {}),
    sourceId: draft.databaseId,
    items: next,
  };
}
