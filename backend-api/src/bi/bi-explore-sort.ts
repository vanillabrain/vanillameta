/**
 * Deterministic pivot row ordering. A label sort compares the tuple itself; a value sort reads one
 * selected measure, so a row with no value still sorts last in either direction.
 */
export type PivotRowSort = {
  by: 'label' | 'value' | 'delta' | 'percentChange';
  direction: 'asc' | 'desc';
  /** Every metric order names a selected measure; the label shape omits the key entirely. */
  measureId?: number;
  columnTuple?: (string | number | boolean | null)[];
};

export type PivotSortDirection = 'asc' | 'desc';

/** Numeric text (integer, decimal or exponent) compares by magnitude instead of through Number(). */
const NUMERIC_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

type Decimal = { negative: boolean; digits: string; exponent: number };

/** Exact decimal of a finite number or numeric string: value = sign * digits * 10^exponent. */
const decimal = (value: unknown): Decimal | null => {
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value;
  if (typeof text !== 'string' || !NUMERIC_TEXT.test(text)) return null;
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return null;
  const fraction = match[3] ?? '';
  const exponent = (match[4] ? Number(match[4]) : 0) - fraction.length;
  const digits = ((match[2] ?? '') + fraction).replace(/^0+/, '');
  return { negative: match[1] === '-' && digits !== '', digits, exponent };
};

/** Same magnitude means the same digit count, so a right-padded text compare is exact. */
const compareDigits = (left: string, right: string) => {
  const length = Math.max(left.length, right.length);
  const one = left.padEnd(length, '0');
  const other = right.padEnd(length, '0');
  return one === other ? 0 : one < other ? -1 : 1;
};

const compareDecimals = (left: Decimal, right: Decimal) => {
  if (left.digits === '' && right.digits === '') return 0;
  if (left.digits === '') return right.negative ? 1 : -1;
  if (right.digits === '') return left.negative ? -1 : 1;
  if (left.negative !== right.negative) return left.negative ? -1 : 1;
  const leftMagnitude = left.exponent + left.digits.length;
  const rightMagnitude = right.exponent + right.digits.length;
  const order =
    leftMagnitude === rightMagnitude
      ? compareDigits(left.digits, right.digits)
      : leftMagnitude < rightMagnitude
      ? -1
      : 1;
  return left.negative ? -order : order;
};

const compareText = (left: unknown, right: unknown) => {
  const one = String(left);
  const other = String(right);
  return one === other ? 0 : one < other ? -1 : 1;
};

/** null sorts after any value in both directions, so a direction flip never lifts a missing row. */
const compareValues = (left: unknown, right: unknown, direction: PivotSortDirection) => {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  const one = decimal(left);
  const other = decimal(right);
  const compared = one && other ? compareDecimals(one, other) : compareText(left, right);
  return direction === 'asc' ? compared : -compared;
};

/** Element-wise tuple order with null last; numbers compare numerically, everything else as text. */
export const compareTuples = (
  left: unknown[],
  right: unknown[],
  direction: PivotSortDirection = 'asc',
) => {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const one = left[index] ?? null;
    const other = right[index] ?? null;
    if (one === other) continue;
    if (one === null) return 1;
    if (other === null) return -1;
    if (typeof one === 'number' && typeof other === 'number') {
      const compared = one < other ? -1 : 1;
      return direction === 'asc' ? compared : -compared;
    }
    const oneText = String(one);
    const otherText = String(other);
    if (oneText === otherText) continue;
    const compared = oneText < otherText ? -1 : 1;
    return direction === 'asc' ? compared : -compared;
  }
  return 0;
};

export type PivotRowSortInput = {
  /** Unique, already bounded leaf row tuples. */
  tuples: unknown[][];
  sort: PivotRowSort;
  /** Group leaves under their first row column when the hierarchy is present. */
  hierarchy: boolean;
  /** Selected current/change score of the row total or scoped cell for one leaf tuple. */
  value: (tuple: unknown[]) => unknown;
  /** Selected score of the parent's raw subtotal or scoped parent cell. */
  parentValue: (parent: unknown) => unknown;
};

/**
 * Flat rows sort by label or by row-total value; under a hierarchy the parents order by their own
 * subtotal and each parent's leaves sort among themselves, so a parent never separates its children.
 */
export const sortPivotRows = ({
  tuples,
  sort,
  hierarchy,
  value,
  parentValue,
}: PivotRowSortInput): unknown[][] => {
  const direction = sort.direction;
  const byLabel = (left: unknown[], right: unknown[]) => compareTuples(left, right, direction);
  const byValue = (left: unknown[], right: unknown[]) => {
    const compared = compareValues(value(left), value(right), direction);
    // A tie falls back to the ascending label order so the result stays deterministic.
    return compared !== 0 ? compared : compareTuples(left, right, 'asc');
  };
  const compare = sort.by === 'label' ? byLabel : byValue;
  if (!hierarchy) return [...tuples].sort(compare);
  const groups = new Map<string, { parent: unknown; leaves: unknown[][] }>();
  for (const tuple of tuples) {
    const parent = tuple[0] ?? null;
    const key = JSON.stringify([parent]);
    const group = groups.get(key) ?? { parent, leaves: [] };
    group.leaves.push(tuple);
    groups.set(key, group);
  }
  const parents = [...groups.values()].sort((left, right) => {
    const compared =
      sort.by === 'label'
        ? compareTuples([left.parent], [right.parent], direction)
        : compareValues(parentValue(left.parent), parentValue(right.parent), direction);
    return compared !== 0 ? compared : compareTuples([left.parent], [right.parent], 'asc');
  });
  return parents.flatMap(group => group.leaves.sort(compare));
};
