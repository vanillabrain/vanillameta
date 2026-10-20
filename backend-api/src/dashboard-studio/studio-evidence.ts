import { StudioDocumentV1 } from './studio-contract';
import { compileMetricFormula, FormulaNode } from '../bi/metric-formula';
import { metricExpression } from '../bi/metric-expression';
import { canonicalMetricSql } from './studio-remix-template';

/** Reconstruct the formula from the saved snapshot and prove it matches the executed SQL. */
function formulaEvidence(definition: any, item: any, block: any, widget: any, schema: any[]) {
  try {
    const profile = {
      sourceId: definition.sourceId,
      columns: schema.map(column => ({
        name: column.column_name,
        numeric: /^(U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|U?HUGEINT|FLOAT|DOUBLE|DECIMAL)/i.test(
          column.column_type,
        ),
      })),
    };
    const compiled = compileMetricFormula(definition.formula, profile, metricExpression);
    if (
      compiled.unit !== definition.unit ||
      widget.sql !== canonicalMetricSql(definition, block.kind, item.dimension, profile)
    )
      return null;
    const label = (node: FormulaNode): string => {
      if ('metricId' in node) {
        const operand = definition.formula.operands.find(
          value => value.id === node.metricId && value.definitionVersion === node.definitionVersion,
        );
        return `${operand.definition.label || '지표'} (#${operand.id} · v${
          operand.definitionVersion
        })`;
      }
      const result = `(${label(node.left)} ${
        node.op === 'ratio' ? '÷' : node.op === 'add' ? '+' : '−'
      } ${label(node.right)})`;
      return result + (node.op === 'ratio' && node.scale === 100 ? ' × 100' : '');
    };
    return {
      aggregation: 'FORMULA',
      unit: definition.unit,
      expressionLabel: label(definition.formula.expression),
    };
  } catch {
    return null;
  }
}

/** Calculation identity excludes titles, positions and number formatting; those do not change rows. */
export const studioEvidenceQuery = (document: StudioDocumentV1) => ({
  filters: document.filters ?? [],
  dateRange: document.dateRange ?? null,
  blocks: document.blocks.map(block => ({
    id: block.id,
    definitionKey: block.definitionKey,
    kind: block.kind,
    measureRefs: block.measureRefs,
    dimensionRefs: block.dimensionRefs,
    timeGrain: block.display.timeGrain ?? 'auto',
    ...(block.pivot ? { pivot: block.pivot } : {}),
  })),
});

/** Only caller-authorized, pinned successful executions may use this projection. Never read current metric definitions. */
export function buildStudioEvidence(input: {
  document: StudioDocumentV1;
  sourceRevision: string;
  schemaVersion: string;
  dataVersion: string;
  definitionBlocks: StudioDocumentV1['blocks'];
  calculationItems: any[];
  preview: any;
  schema?: any[];
}) {
  const { document, preview } = input;
  if (!preview || preview.widgets?.length !== document.blocks.length)
    throw new Error('Successful matching preview required for execution evidence');
  return {
    schemaVersion: 1 as const,
    queriedAt: new Date().toISOString(),
    documentRevision: document.revision ?? null,
    source: {
      id: document.sourceId,
      revision: input.sourceRevision,
      schemaVersion: input.schemaVersion,
      dataVersion: input.dataVersion,
    },
    query: studioEvidenceQuery(document),
    blocks: document.blocks.map((block, index) => {
      const original = input.definitionBlocks.findIndex(
        b => b.definitionKey === block.definitionKey,
      );
      const item = input.calculationItems[original];
      const definition = item?.definition;
      const ref = block.measureRefs.length === 1 ? block.measureRefs[0] : null;
      const linked =
        ref &&
        item?.metricId === ref.id &&
        String(item?.definitionVersion) === ref.definitionVersion &&
        definition?.schemaVersion === 1 &&
        definition?.sourceId === document.sourceId &&
        String(definition?.definitionVersion) === ref.definitionVersion;
      // Persisted structured snapshots are the evidence. Unknown legacy SQL is explicitly unproven.
      const calculation = linked
        ? definition.aggregation === 'FORMULA'
          ? formulaEvidence(definition, item, block, preview.widgets[index], input.schema ?? [])
          : Object.fromEntries(
              ['aggregation', 'column', 'denominatorColumn', 'weightColumn', 'scale', 'unit']
                .filter(key => ['string', 'number'].includes(typeof definition[key]))
                .map(key => [key, definition[key]]),
            )
        : null;
      return {
        blockId: block.id,
        measureRefs: block.measureRefs.map(ref => ({
          id: ref.id,
          definitionVersion: ref.definitionVersion,
        })),
        calculation,
        resultStatus: preview.widgets[index]?.grainUnavailable ? 'unavailable' : 'available',
        aggregateRowCount: preview.widgets[index]?.grainUnavailable
          ? null
          : Array.isArray(preview.widgets[index]?.datas)
          ? preview.widgets[index].datas.length
          : null,
      };
    }),
  };
}
