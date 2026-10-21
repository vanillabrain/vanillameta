import test from "node:test";
import assert from "node:assert/strict";
import { preview, proposal, metric } from "../src/projection.js";
test("all blocks remain while aggregate row caps are explicit and integer strings survive", () => {
  const rows = Array.from({ length: 241 }, () => ({
    v: "9007199254740993",
    secret: "hidden",
  }));
  const p = preview({
    widgets: [
      { valueField: "v", datas: rows },
      { valueField: "v", datas: [{ v: "10" }] },
    ],
  });
  assert.equal(p.widgets.length, 2);
  assert.equal(p.widgets[0].totalRows, 241);
  assert.equal(p.widgets[0].truncated, true);
  assert.equal(p.widgets[0].datas.length, 240);
  assert.deepEqual(p.widgets[0].datas[0], { v: "9007199254740993" });
});
test("clarification and expired/no-preview state never claim persistence", () => {
  const p = proposal({
    proposalId: "id",
    sourceId: 1,
    clarifications: [
      { id: "missingColumns", question: "Which column?", choices: [] },
    ],
  });
  assert.equal(p.persisted, false);
  assert.equal(p.preview, null);
  assert.equal(p.clarifications.length, 1);
});

test("ratio denominator/scale and weighting inputs remain reviewable", () => {
  const ratio = metric({
    definition: {
      aggregation: "RATIO_SUM",
      column: "refunds",
      denominatorColumn: "revenue",
      scale: 100,
    },
  }).definition;
  assert.equal(ratio.denominatorColumn, "revenue");
  assert.equal(ratio.scale, 100);
  assert.notDeepEqual(
    ratio,
    metric({
      definition: {
        aggregation: "RATIO_SUM",
        column: "refunds",
        denominatorColumn: "orders",
        scale: 1,
      },
    }).definition
  );
  assert.equal(
    metric({
      definition: {
        aggregation: "WEIGHTED_AVG",
        column: "price",
        weightColumn: "quantity",
      },
    }).definition.weightColumn,
    "quantity"
  );
});
