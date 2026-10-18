import { BadRequestException } from '@nestjs/common';
import { MetricAggregation } from '../metric/entities/metric.entity';
import { quoteColumn } from '../ai/dashboard-draft';
import { compileMetricFormula, normalizeFormulaUnit } from './metric-formula';

/** Canonical structured metric compiler shared by creation and AI references. */
export function metricFields(body: any, profile: any) {
  const aggregation = body.aggregation;
  if (aggregation === 'FORMULA') {
    if (body.column !== '*') throw new BadRequestException('계산 지표의 정의를 확인해 주세요.');
    const compiled = compileMetricFormula(body.formula, profile, metricExpression);
    if (normalizeFormulaUnit(body.unit) !== compiled.unit)
      throw new BadRequestException('계산 지표의 단위가 참조 정의와 다릅니다.');
    return { column: '*', formula: JSON.parse(JSON.stringify(body.formula)) };
  }
  if (![...Object.values(MetricAggregation), 'RATIO_SUM', 'WEIGHTED_AVG'].includes(aggregation))
    throw new BadRequestException('지원하지 않는 집계입니다.');
  const field = profile.columns.find(c => c.name === body.column);
  if (aggregation !== 'COUNT' && field?.nonAdditive)
    throw new BadRequestException(
      '사전의 숫자 속성·집계된 고유값은 다시 합산하거나 계산할 수 없습니다. 원본 사실 행 또는 식별 키를 연결해 주세요.',
    );
  if (aggregation !== 'COUNT' && (!field || (aggregation !== 'COUNT_DISTINCT' && !field.numeric)))
    throw new BadRequestException('집계에 맞는 숫자 컬럼을 선택해 주세요.');
  const fields: any = { column: aggregation === 'COUNT' ? '*' : field.name };
  if (aggregation === 'RATIO_SUM' || aggregation === 'WEIGHTED_AVG') {
    const key = aggregation === 'RATIO_SUM' ? 'denominatorColumn' : 'weightColumn';
    const secondary = profile.columns.find(c => c.name === body[key]);
    if (secondary?.nonAdditive)
      throw new BadRequestException(
        '집계된 고유값은 분모·가중치로 재집계할 수 없습니다. 원본 식별 키를 연결해 주세요.',
      );
    if (!secondary?.numeric)
      throw new BadRequestException('분모 또는 가중치에 사용할 숫자 컬럼을 선택해 주세요.');
    fields[key] = secondary.name;
    if (aggregation === 'RATIO_SUM') {
      if (![1, 100].includes(body.scale))
        throw new BadRequestException('비율은 1배, 백분율은 100배를 선택해 주세요.');
      fields.scale = body.scale;
    }
  }
  return fields;
}
export function metricExpression(definition: any, profile: any) {
  const fields = metricFields(definition, profile);
  if (definition.aggregation === 'FORMULA')
    return compileMetricFormula(fields.formula, profile, metricExpression).sql;
  const value = quoteColumn(fields.column);
  if (definition.aggregation === 'RATIO_SUM')
    return `SUM(CAST(${value} AS DOUBLE)) / NULLIF(SUM(CAST(${quoteColumn(
      fields.denominatorColumn,
    )} AS DOUBLE)), 0) * ${fields.scale}`;
  if (definition.aggregation === 'WEIGHTED_AVG') {
    const weight = quoteColumn(fields.weightColumn);
    return `CASE WHEN MIN(${weight}) < 0 THEN NULL ELSE SUM(CAST(${value} AS DOUBLE) * CAST(${weight} AS DOUBLE)) / NULLIF(SUM(CASE WHEN ${value} IS NOT NULL THEN CAST(${weight} AS DOUBLE) END), 0) END`;
  }
  return definition.aggregation === 'COUNT'
    ? 'COUNT(*)'
    : definition.aggregation === 'COUNT_DISTINCT'
    ? `COUNT(DISTINCT ${value})`
    : `${definition.aggregation}(${value})`;
}
