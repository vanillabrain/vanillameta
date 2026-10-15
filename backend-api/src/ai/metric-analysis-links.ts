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
    sourceId: draft.databaseId,
    items: next,
  };
}
