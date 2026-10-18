import { BadRequestException } from '@nestjs/common';
import { quoteColumn } from '../ai/dashboard-draft';
import { metricExpression } from './metric-expression';
import { metricDependencyColumns } from './metric-dependencies';

export type GovernedColumn = {
  name: string;
  type: string;
  numeric?: boolean;
  temporal?: boolean;
  nonAdditive?: boolean;
};
export type GovernedFilter = { column: string; values: (string | number | boolean | null)[] };
export type GovernedBlock = {
  id: string;
  title: string;
  kind: string;
  metric: any;
  dimension?: string;
  display: {
    decimalPlaces: number;
    numberNotation: 'full' | 'compact';
    suffix?: string;
    presentation?: string;
  };
};
/** Private server recipe. Never serialize sourceId, mandatory filters or metric definitions to a member. */
export type GovernedRecipe = {
  sourceId: number;
  columns: GovernedColumn[];
  mandatory: GovernedFilter[];
  blocks: GovernedBlock[];
};
function deny(): never {
  throw new BadRequestException('허용된 지표·열·조건만 사용할 수 있습니다.');
}
export function governedKeys(value: unknown, fields: string[]): Record<string, any> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(k => !fields.includes(k))
  )
    deny();
  return value as Record<string, any>;
}
/** Typed, bounded equality sets only. Server mandatory predicates are never accepted in request bodies. */
export function governedFilters(input: unknown, columns: GovernedColumn[]): GovernedFilter[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 4) deny();
  const seen = new Set<string>();
  return input.map(item => {
    const filter = governedKeys(item, ['column', 'values']);
    const col = columns.find(c => c.name === filter.column);
    if (
      !col ||
      seen.has(col.name) ||
      !Array.isArray(filter.values) ||
      !filter.values.length ||
      filter.values.length > 20
    )
      deny();
    seen.add(col.name);
    const valid = (v: unknown) =>
      v === null ||
      (col.numeric
        ? typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER
        : /^BOOLEAN$/i.test(col.type)
        ? typeof v === 'boolean'
        : typeof v === 'string' && v.length <= 256);
    if (!filter.values.every(valid)) deny();
    return { column: col.name, values: filter.values };
  });
}
export function validateGovernedRecipe(recipe: GovernedRecipe, fullColumns: GovernedColumn[]) {
  if (
    !Array.isArray(recipe.columns) ||
    !recipe.columns.length ||
    recipe.columns.length > 32 ||
    new Set(recipe.columns.map(c => c.name)).size !== recipe.columns.length ||
    recipe.columns.some(c => !fullColumns.some(f => f.name === c.name && f.type === c.type)) ||
    !Array.isArray(recipe.blocks) ||
    !recipe.blocks.length ||
    recipe.blocks.length > 6 ||
    new Set(recipe.blocks.map(b => b.id)).size !== recipe.blocks.length
  )
    deny();
  governedFilters(recipe.mandatory, fullColumns);
  if (!recipe.mandatory.length) deny();
  for (const b of recipe.blocks) {
    if (
      !['BOARD_NUMERIC', 'CHART_LINE', 'CHART_BAR', 'CHART_COLUMN'].includes(b.kind) ||
      typeof b.id !== 'string' ||
      !b.id ||
      b.id.length > 100 ||
      typeof b.title !== 'string' ||
      b.title.length > 300 ||
      (b.kind === 'BOARD_NUMERIC'
        ? !!b.dimension
        : !recipe.columns.some(c => c.name === b.dimension)) ||
      (b.kind === 'CHART_LINE' && !recipe.columns.find(c => c.name === b.dimension)?.temporal)
    )
      deny();
    const profile = { sourceId: recipe.sourceId, columns: recipe.columns };
    const dependencies = metricDependencyColumns(b.metric, profile);
    if (dependencies.some(c => !recipe.columns.some(f => f.name === c))) deny();
    metricExpression(b.metric, profile);
  }
}
/** Same projected relation for totals, charts, values, details, CSV and AI-generated plans. */
export function governedPlan(
  recipe: GovernedRecipe,
  input: unknown,
  mode: 'query' | 'rows' | 'values' = 'query',
) {
  const body = governedKeys(
    input,
    mode === 'values'
      ? ['column', 'filters']
      : mode === 'rows'
      ? ['filters']
      : ['blockIds', 'filters'],
  );
  const filters = governedFilters(body.filters, recipe.columns),
    bindings: any[] = [];
  const predicate = (f: GovernedFilter) =>
    '(' +
    f.values
      .map(v => {
        bindings.push(v);
        return `${quoteColumn(f.column)} IS NOT DISTINCT FROM ?`;
      })
      .join(' OR ') +
    ')';
  // Mandatory constraints are applied against the original relation before projecting approved columns.
  const cte = `WITH governed_rows AS (SELECT ${recipe.columns
    .map(c => quoteColumn(c.name))
    .join(', ')} FROM uploaded_data WHERE ${recipe.mandatory.map(predicate).join(' AND ')})`;
  const where = filters.length ? ' WHERE ' + filters.map(predicate).join(' AND ') : '';
  if (mode === 'rows')
    return {
      filters,
      queries: [
        {
          sql: `${cte} SELECT ${recipe.columns
            .map(c => quoteColumn(c.name))
            .join(', ')} FROM governed_rows${where} ORDER BY ALL LIMIT 51`,
          bindings,
        },
      ],
    };
  if (mode === 'values') {
    const column = recipe.columns.find(c => c.name === body.column);
    if (!column) deny();
    return {
      filters,
      queries: [
        {
          sql: `${cte} SELECT DISTINCT ${quoteColumn(
            column.name,
          )} AS value FROM governed_rows${where} ORDER BY value NULLS LAST LIMIT 51`,
          bindings,
        },
      ],
    };
  }
  const ids = body.blockIds === undefined ? recipe.blocks.map(b => b.id) : body.blockIds;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 6 ||
    new Set(ids).size !== ids.length ||
    ids.some(id => !recipe.blocks.some(b => b.id === id))
  )
    deny();
  return {
    filters,
    queries: ids.map(id => {
      const block = recipe.blocks.find(b => b.id === id)!;
      const dimension = block.dimension ? quoteColumn(block.dimension) : '';
      return {
        block,
        sql: `${cte} SELECT ${dimension ? dimension + ' AS dimension, ' : ''}${metricExpression(
          block.metric,
          { sourceId: recipe.sourceId, columns: recipe.columns },
        )} AS value FROM governed_rows${where}${
          dimension
            ? ` GROUP BY ${dimension} ORDER BY ${
                block.kind === 'CHART_LINE' ? 'dimension' : 'value DESC'
              } LIMIT 201`
            : ''
        }`,
        bindings,
      };
    }),
  };
}
