import { compileMetricFormula } from './metric-formula';
import { metricExpression, metricFields } from './metric-expression';

export function metricDependencyColumns(definition: any, profile: any): string[] {
  if (
    definition?.schemaVersion !== 1 ||
    definition.sourceId !== profile.sourceId ||
    definition.tableName !== 'uploaded_data'
  )
    throw new Error('unknown metric definition');
  metricExpression(definition, profile);
  const fields = metricFields(definition, profile);
  if (definition.aggregation === 'FORMULA')
    return compileMetricFormula(fields.formula, profile, metricExpression).columns;
  return [
    ...new Set(
      [fields.column, fields.denominatorColumn, fields.weightColumn].filter(
        value => typeof value === 'string' && value !== '*',
      ),
    ),
  ] as string[];
}
