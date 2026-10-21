// Deliberately exclude connectionConfig, source samples, SQL and internal file paths.
const pick = (value, keys) =>
  Object.fromEntries(
    keys.filter((k) => value?.[k] !== undefined).map((k) => [k, value[k]])
  );
export const metric = (value) => ({
  ...pick(value, ["id", "label", "definitionVersion"]),
  definition: pick(value.definition, [
    "sourceId",
    "label",
    "aggregation",
    "column",
    "denominatorColumn",
    "scale",
    "weightColumn",
    "unit",
    "decimalPlaces",
    "numberNotation",
    "formula",
  ]),
});
export function source(value) {
  return pick(value, ["id", "name", "engine"]);
}
export function profile(value) {
  return {
    ...pick(value, [
      "sourceId",
      "name",
      "engine",
      "supported",
      "status",
      "dataVersion",
      "rowCount",
    ]),
    columns: (value.columns ?? []).map((c) =>
      pick(c, [
        "name",
        "type",
        "numeric",
        "temporal",
        "nullCount",
        "min",
        "max",
        "nonAdditive",
      ])
    ),
  };
}
export function preview(value) {
  if (!value) return null;
  return {
    sourceRevision: value.sourceRevision,
    widgets: (value.widgets ?? []).map((w) => {
      const keys = [w.valueField, w.categoryField].filter(
        (k) => typeof k === "string"
      );
      const rows = w.datas ?? [];
      return {
        ...pick(w, [
          "blockId",
          "type",
          "title",
          "valueField",
          "categoryField",
          "prefix",
          "suffix",
          "decimalPlaces",
          "numberNotation",
        ]),
        datas: rows.slice(0, 240).map((r) => pick(r, keys)),
        totalRows: rows.length,
        truncated: rows.length > 240,
      };
    }),
  };
}
export function proposal(value) {
  return {
    ...pick(value, ["proposalId", "sourceId", "sourceRevision", "title"]),
    clarifications: (value.clarifications ?? []).map((c) => ({
      ...pick(c, ["id", "question"]),
      choices: (c.choices ?? []).map((x) => pick(x, ["value", "label"])),
    })),
    blocks: (value.semanticProposal ?? []).map((b) => ({
      ...pick(b, ["title", "kind"]),
      metric: metric({ ...b.metric, definition: b.metric }),
      dimension: pick(b.dimension, ["column", "type"]),
    })),
    preview: preview(value.preview),
    persisted: false,
    nextAction: value.preview
      ? "Review every block and calculation, then request explicit user approval before vm_save_analysis."
      : "Clarify the request and call vm_propose_analysis again. No artifact has been saved.",
  };
}
export function artifact(value, config) {
  const doc = value.document;
  return {
    dashboardId: value.dashboardId ?? doc.dashboardId,
    sourceId: doc.sourceId,
    title: doc.title,
    revision: doc.revision,
    blocks: (doc.blocks ?? []).map((b) => pick(b, ["id", "title", "kind"])),
    studioUrl: `${config.webUrl}/dashboard/${
      value.dashboardId ?? doc.dashboardId
    }/studio`,
    persisted: true,
    publicationChanged: false,
    ...(value.preview ? { preview: preview(value.preview) } : {}),
    ...(value.previewError ? { previewUnavailable: true } : {}),
  };
}
