import { BadRequestException } from '@nestjs/common';
import { quoteColumn } from '../ai/dashboard-draft';
import { metricExpression } from './metric-expression';

/** Shared by saved-metric creation and transient semantic proposals; never writes. */
export function compileMetricWidget(
  definition: any,
  profile: any,
  chart: any,
  dimensionName: any,
  title: string,
) {
  const expr = metricExpression(definition, profile);
  if (!['number', 'bar', 'line'].includes(chart))
    throw new BadRequestException('차트를 선택해 주세요.');
  const dimension =
    chart === 'number' ? undefined : profile.columns.find(c => c.name === dimensionName);
  if (chart !== 'number' && !dimension) throw new BadRequestException('분류 컬럼을 선택해 주세요.');
  if (chart === 'line' && !dimension.temporal)
    throw new BadRequestException('추세 차트에는 날짜 컬럼이 필요합니다.');
  const group = dimension ? quoteColumn(dimension.name) : undefined;
  const sql = `SELECT ${group ? `${group} AS dimension, ` : ''}${expr} AS value FROM source${
    group
      ? ` GROUP BY ${group} ORDER BY ${chart === 'line' ? 'dimension' : 'value DESC'} LIMIT 500`
      : ''
  }`;
  return {
    dimension,
    widget: {
      title,
      description: definition.label,
      type: chart === 'number' ? 'BOARD_NUMERIC' : chart === 'bar' ? 'CHART_COLUMN' : 'CHART_LINE',
      sql,
      valueField: 'value',
      ...(group ? { categoryField: 'dimension' } : {}),
      decimalPlaces: definition.decimalPlaces,
      suffix: definition.unit ? ' ' + definition.unit : '',
      numberNotation: definition.numberNotation === 'plain' ? 'full' : 'compact',
    },
  };
}
