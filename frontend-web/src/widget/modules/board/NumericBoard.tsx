import React from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, Typography } from '@mui/material';
import { WIDGET_AGGREGATION } from '@/constant';
import * as math from 'mathjs';
import { getAggregationData } from '@/widget/modules/utils/chartUtil';

const NumericBoard = props => {
  const { t } = useTranslation();
  const { option, dataSet, sx } = props;

  const defaultComponentOption = {
    header: { title: t('common.defaultTitle'), fontSize: 16, color: '#cccccc' },
    content: { field: null, aggregation: null, fontSize: 16, color: '#cccccc', prefix: '', suffix: '' },
  };

  const componentOption = {
    header: { ...defaultComponentOption.header, ...option?.header },
    content: { ...defaultComponentOption.content, ...option?.content },
  };
  const { field, aggregation, decimalPlaces, numForm, prefix, suffix, numberNotation } = componentOption.content;
  const precisionSet =
    typeof decimalPlaces === 'number' && Number.isInteger(decimalPlaces) && decimalPlaces >= 0 && decimalPlaces <= 6;
  const rows = dataSet || [];
  const values = rows
    .map(row => row[field])
    .filter(
      value =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== '' &&
        /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(value)),
    );
  const valid = aggregation === WIDGET_AGGREGATION.CNT || values.length > 0;
  const numbers = values.map(value => math.bignumber(String(value)));
  let raw = null;
  if (valid) {
    switch (aggregation) {
      case WIDGET_AGGREGATION.CNT:
        raw = math.bignumber(rows.filter(row => row[field] !== null && row[field] !== undefined).length);
        break;
      case WIDGET_AGGREGATION.SUM:
      case WIDGET_AGGREGATION.AVG:
        raw = numbers.reduce((sum, value) => sum.plus(value), math.bignumber(0));
        if (aggregation === WIDGET_AGGREGATION.AVG) raw = raw.dividedBy(numbers.length);
        break;
      case WIDGET_AGGREGATION.MIN:
        raw = numbers.reduce((min, value) => (value.lessThan(min) ? value : min));
        break;
      case WIDGET_AGGREGATION.MAX:
        raw = numbers.reduce((max, value) => (value.greaterThan(max) ? value : max));
        break;
    }
  }
  const unsafe =
    numbers.some(value => value.abs().greaterThan(Number.MAX_SAFE_INTEGER)) ||
    raw?.abs().greaterThan(Number.MAX_SAFE_INTEGER);
  let formatted = '—';
  if (raw !== null) {
    if (precisionSet || unsafe) {
      formatted = precisionSet ? raw.toFixed(decimalPlaces) : raw.toFixed();
      if (numForm) {
        const [integer, fraction] = formatted.split('.');
        formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : `.${fraction}`);
      }
    } else {
      const result = getAggregationData(aggregation, rows, field);
      formatted = numForm ? result.toLocaleString('ko-KR') : String(result);
    }
    if (numberNotation === 'compact' && raw.abs().greaterThanOrEqualTo(1000)) {
      const units = ['K', 'M', 'B', 'T'];
      let unit = 0;
      let scaled = raw.dividedBy(1000);
      const places = precisionSet ? decimalPlaces : 1;
      while (unit < units.length - 1 && math.bignumber(scaled.abs().toFixed(places)).greaterThanOrEqualTo(1000)) {
        scaled = scaled.dividedBy(1000);
        unit += 1;
      }
      formatted = `${scaled
        .toFixed(places)
        .replace(/(\.\d*?)0+$/, '$1')
        .replace(/\.$/, '')}${units[unit]}`;
    }
  }
  const score = raw === null ? formatted : `${prefix ?? ''}${formatted}${suffix ?? ''}`;
  const rawValue = raw === null ? t('common.noData', { defaultValue: 'No data' }) : raw.toFixed();

  return (
    <Stack
      sx={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minWidth: 0,
        containerType: 'inline-size',
        ...sx,
      }}
    >
      <Typography
        component="span"
        sx={{
          display: 'block',
          maxWidth: '700px', // 글자 최대너비 제한
          width: '100%',
          mx: 'auto',
          fontSize: componentOption.header.fontSize,
          color: componentOption.header.color,
          textAlign: 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {componentOption.header.title}
      </Typography>
      <Typography
        component="span"
        title={rawValue}
        aria-label={rawValue}
        sx={{
          display: 'block',
          maxWidth: '700px', // 글자 최대너비 제한
          width: '100%',
          mx: 'auto',
          fontSize: `clamp(10px, ${100 / Math.max(score.length * 0.65, 1)}cqw, ${componentOption.content.fontSize}px)`,
          lineHeight: 1.2,
          color: componentOption.content.color,
          fontWeight: 'bold',
          textAlign: 'center',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
        }}
      >
        {score}
      </Typography>
    </Stack>
  );
};

export default NumericBoard;
