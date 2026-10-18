import { BadRequestException } from '@nestjs/common';
import { metricExpression } from './metric-expression';
import {
  BusinessBasis,
  businessProfile,
  businessDimensionExpression,
  sliceBusinessBasis,
} from './semantic-business-basis';

/** Shared by saved-metric creation and transient semantic proposals; never writes. */
export function compileMetricWidget(
  definition: any,
  profile: any,
  chart: any,
  dimensionName: any,
  title: string,
  dimensionBasis: BusinessBasis = profile.businessBasis,
) {
  const expr = metricExpression(definition, profile);
  const effective = businessProfile(profile, dimensionBasis);
  if (!['number', 'bar', 'line'].includes(chart))
    throw new BadRequestException('차트를 선택해 주세요.');
  const dimension =
    chart === 'number' ? undefined : effective.columns.find(c => c.name === dimensionName);
  if (chart !== 'number' && !dimension) throw new BadRequestException('분류 컬럼을 선택해 주세요.');
  if (chart === 'line' && !dimension.temporal)
    throw new BadRequestException('추세 차트에는 날짜 컬럼이 필요합니다.');
  const group = dimension
    ? businessDimensionExpression(profile, dimensionBasis, dimension.name)
    : undefined;
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
      ...(dimensionBasis && dimension
        ? { businessBasis: sliceBusinessBasis(dimensionBasis, [dimension.name]) }
        : {}),
    },
  };
}
