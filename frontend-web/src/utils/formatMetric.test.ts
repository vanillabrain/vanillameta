import { describe, expect, it } from 'vitest';
import { formatMetric } from './formatMetric';

describe('metric presentation', () => {
  it.each([null, undefined, '', '  ', true, false, {}, 'NaN', 'Infinity', Infinity, '0x10', '1,000'])(
    'does not coerce invalid input %j into zero',
    value => {
      expect(formatMetric(value).text).toBe('값 없음');
    },
  );
  it.each([
    ['999999', '1M'],
    ['999999999', '1B'],
    ['999999999999', '1T'],
    ['-999999', '-1M'],
    ['1000', '1K'],
    ['0', '0'],
  ])('carries rounded compact boundaries for %s', (value, text) => {
    expect(formatMetric(value, { numberNotation: 'compact' }).text).toBe(text);
  });
  it('uses saved decimals for compact values and fixed full currency decimals', () => {
    expect(formatMetric('1234567', { prefix: '$', decimalPlaces: 2, numberNotation: 'compact' }).text).toBe('$1.23M');
    expect(formatMetric('5', { prefix: '$', decimalPlaces: 2 }).text).toBe('$5.00');
    expect(formatMetric('1.005', { decimalPlaces: 2 }).text).toBe('1.01');
    expect(formatMetric('-.5', { decimalPlaces: 2 }).text).toBe('-0.50');
  });
  it('retains exact unsafe integers, decimals and exponential strings in full display and descriptions', () => {
    const value = '9007199254740993.123456789';
    const options = { prefix: '$', suffix: ' USD', decimalPlaces: 2 };
    const full = formatMetric(value, options);
    expect(full.text).toBe('$9,007,199,254,740,993.123456789 USD');
    const compact = formatMetric(value, { ...options, numberNotation: 'compact' });
    expect(compact.text).toBe('$9,007.2T USD');
    expect(compact.fullText).toBe(full.text);
    expect(compact.exactText).toBe('$9007199254740993.123456789 USD');
    expect(formatMetric('9.007199254740993e15').text).toBe('9,007,199,254,740,993');
    const huge = '123456789012345678901234567890123456789012345678901234567890123456789';
    expect(formatMetric(huge).exactText).toBe(huge);
  });
  it('preserves signed currency changes without Number conversion or negative zero', () => {
    expect(formatMetric('9007199254740993', { prefix: '$', signed: true }).text).toBe('+$9,007,199,254,740,993');
    expect(formatMetric('-999999', { prefix: '$', signed: true, numberNotation: 'compact' }).text).toBe('-$1M');
    expect(formatMetric('-0.001', { decimalPlaces: 2, signed: true }).text).toBe('0.00');
    expect(formatMetric('0', { signed: true }).text).toBe('0');
  });
});

it('keeps more than twenty unsafe fractional digits even with a smaller saved precision', () => {
  const raw = '9007199254740993.12345678901234567890123456789012345';
  const full = formatMetric(raw, { decimalPlaces: 2 });
  expect(full.text).toBe('9,007,199,254,740,993.12345678901234567890123456789012345');
  expect(formatMetric(raw, { numberNotation: 'compact', decimalPlaces: 2 }).fullText).toBe(full.text);
  expect(full.exactText).toBe(raw);
  expect(formatMetric('5', { decimalPlaces: 25 }).text).toBe('5.' + '0'.repeat(25));
});

it('does not emit negative zero but retains the exact negative value when display rounds to zero', () => {
  const rounded = formatMetric('-0.001', { decimalPlaces: 2, signed: true });
  expect(rounded.text).toBe('0.00');
  expect(rounded.fullText).toBe('0.00');
  expect(rounded.exactText).toBe('-0.001');
  expect(formatMetric('-0', { decimalPlaces: 2, signed: true }).exactText).toBe('0');
  expect(formatMetric('-0.000', { numberNotation: 'compact' }).text).toBe('0');
});

it('localizes only canonical count suffixes for Korean without changing custom units', async () => {
  const { localizedMetricSuffix } = await import('./formatMetric');
  expect(localizedMetricSuffix(' count', 'ko-KR')).toBe('건');
  expect(localizedMetricSuffix('count', 'ko')).toBe('건');
  expect(localizedMetricSuffix(' count', 'en-US')).toBe(' count');
  expect(localizedMetricSuffix(' count', undefined)).toBe(' count');
  expect(localizedMetricSuffix(' discount', 'ko')).toBe(' discount');
  expect(localizedMetricSuffix(' KRW', 'ko')).toBe(' KRW');
});
