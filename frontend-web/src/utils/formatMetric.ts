import { bignumber } from 'mathjs';

export type NumberNotation = 'compact' | 'full';
export type MetricFormatOptions = {
  numberNotation?: NumberNotation;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
  signed?: boolean;
  trimTrailingZeros?: boolean;
};

/** Translate only the canonical count unit; saved/custom suffixes remain untouched. */
export function localizedMetricSuffix(suffix: string | undefined, language?: string) {
  return /^ko(?:-|$)/i.test(language ?? '') && (suffix === ' count' || suffix === 'count') ? '건' : suffix;
}

/** Validate before parsing: null, blank, booleans and non-decimal syntax are never zero. */
export function metricNumericText(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? text : null;
}

/** Format the original decimal; Number conversion belongs only in chart geometry. */
export function formatMetric(value: unknown, options: MetricFormatOptions = {}) {
  const raw = metricNumericText(value);
  const missing = { text: '값 없음', fullText: '값 없음', exactText: '값 없음' };
  if (raw === null) return missing;
  const decimal = bignumber(raw);
  if (!decimal.isFinite()) return missing;
  const { prefix = '', suffix = '', signed = false, numberNotation = 'full', trimTrailingZeros = false } = options;
  const places =
    Number.isInteger(options.decimalPlaces) && options.decimalPlaces >= 0 && options.decimalPlaces <= 100
      ? options.decimalPlaces
      : 0;
  const magnitude = decimal.abs();
  const trim = (text: string) => (text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text);
  const decorate = (digits: string, compactUnit = '', group = true) => {
    const negative = decimal.isNegative() && !bignumber(digits).isZero();
    const sign = negative ? '-' : signed && !bignumber(digits).isZero() ? '+' : '';
    const [integer, fraction] = digits.split('.');
    const grouped = group ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : integer;
    const number = grouped + (fraction === undefined ? '' : `.${fraction}`) + compactUnit;
    return signed ? `${sign}${prefix}${number}${suffix}` : `${prefix}${sign}${number}${suffix}`;
  };
  // Unsafe strings must retain every supplied digit even when the saved display precision is smaller.
  const fullPlaces = magnitude.greaterThan(Number.MAX_SAFE_INTEGER) ? Math.max(places, decimal.decimalPlaces()) : places;
  const fullDigits = magnitude.toFixed(fullPlaces, 4); // decimal.js ROUND_HALF_UP, without changing global mathjs config.
  const fullText = decorate(trimTrailingZeros ? trim(fullDigits) : fullDigits);
  const exactText = decorate(magnitude.toFixed(), '', false);
  let text = fullText;
  if (numberNotation === 'compact') {
    const units = ['', 'K', 'M', 'B', 'T'];
    let unit = 0;
    let scaled = magnitude;
    while (unit < units.length - 1 && bignumber(scaled.toFixed(places, 4)).greaterThanOrEqualTo(1000)) {
      scaled = scaled.dividedBy(1000);
      unit += 1;
    }
    text = decorate(unit ? trim(scaled.toFixed(places, 4)) : fullDigits, units[unit]);
  }
  return { text, fullText, exactText };
}
