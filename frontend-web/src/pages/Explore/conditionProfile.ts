import { categoryTextType } from './businessVariable';
import type { Column } from './SourceConditions';
export const profileKey = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, v[k]]),
        )
      : v,
  );
const fail = (): never => {
  throw new Error('분포·표본 응답을 확인하지 못했습니다. 다시 조회하세요.');
};
function assert(test: unknown): asserts test {
  if (!test) fail();
}
const count = (value: unknown): string => {
  assert(typeof value === 'string' && /^\d{1,20}$/.test(value));
  return value;
};
const counts = (r: any) => {
  assert(r && typeof r === 'object');
  const c = { total: count(r.total), matched: count(r.matched), excluded: count(r.excluded), remaining: count(r.remaining) };
  assert(BigInt(c.matched) <= BigInt(c.total) && BigInt(c.excluded) + BigInt(c.remaining) === BigInt(c.matched));
  return c;
};
const text = (v: unknown): v is string | null => v === null || (typeof v === 'string' && Array.from(v).length <= 200);
export function readProfileColumns(value: unknown): Column[] {
  assert(Array.isArray(value) && value.length <= 128);
  const names = new Set<string>();
  return value.map(c => {
    assert(
      c &&
        typeof c === 'object' &&
        typeof c.name === 'string' &&
        !!c.name &&
        c.name.length <= 128 &&
        !names.has(c.name) &&
        typeof c.type === 'string' &&
        c.type.length <= 200 &&
        ['string', 'number', 'boolean', 'date', 'timestamp', 'unsupported'].includes(c.kind),
    );
    if (c.businessType !== undefined) assert(['auto', 'number', 'category', 'date'].includes(c.businessType));
    if (c.dateFormat !== undefined) assert(['', 'native', 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD'].includes(c.dateFormat));
    if (c.businessType === 'date') assert(['native', 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD'].includes(c.dateFormat));
    if (categoryTextType(c.type)) assert(c.kind === (c.businessType === 'category' ? 'string' : 'unsupported'));
    names.add(c.name);
    return {
      name: c.name,
      type: c.type,
      kind: c.kind,
      ...(c.businessType === undefined ? {} : { businessType: c.businessType }),
      ...(c.dateFormat === undefined ? {} : { dateFormat: c.dateFormat }),
    };
  });
}
export function readConditionProfile(input: any, selected: string[], columns: Column[]) {
  const c = counts(input?.population);
  for (const [key, value] of [
    ['matchedRatio', c.matched],
    ['remainingRatio', c.remaining],
  ] as const) {
    const expected = BigInt(c.total) ? Number(value) / Number(c.total) : null;
    assert(
      expected === null
        ? input.population[key] === null
        : typeof input.population[key] === 'number' && Math.abs(input.population[key] - expected) < 1e-12,
    );
  }
  assert(Array.isArray(input.distributions) && input.distributions.length === selected.length);
  const distributions = input.distributions.map((d: any, index: number) => {
    const column = columns.find(c => c.name === selected[index]);
    assert(
      column &&
        d.column === column.name &&
        d.type === column.type &&
        d.limit === 20 &&
        Array.isArray(d.rows) &&
        d.rows.length <= 20,
    );
    const rows = d.rows.map((r: any) => {
      assert(text(r.value) && typeof r.valueTruncated === 'boolean');
      return { value: r.value as string | null, valueTruncated: r.valueTruncated, ...counts(r) };
    });
    const other = counts(d.other);
    const groups = count(d.totalGroups);
    assert(
      BigInt(groups) >= BigInt(rows.length) &&
        d.hasMore === BigInt(groups) > BigInt(20) &&
        rows.length === Number(BigInt(groups) > BigInt(20) ? BigInt(20) : BigInt(groups)),
    );
    for (const key of ['total', 'matched', 'excluded', 'remaining'] as const)
      assert(
        BigInt(other[key]) + rows.reduce((sum: bigint, row: any) => sum + BigInt(row[key]), BigInt(0)) === BigInt(c[key]),
      );
    assert(
      d.range &&
        text(d.range.minimum) &&
        text(d.range.maximum) &&
        typeof d.range.minimumTruncated === 'boolean' &&
        typeof d.range.maximumTruncated === 'boolean',
    );
    return {
      column: d.column as string,
      type: d.type as string,
      rows,
      other,
      totalGroups: groups,
      hasMore: d.hasMore as boolean,
      range: {
        minimum: d.range.minimum as string | null,
        maximum: d.range.maximum as string | null,
        minimumTruncated: d.range.minimumTruncated as boolean,
        maximumTruncated: d.range.maximumTruncated as boolean,
      },
    };
  });
  const s = input.sample;
  assert(
    s &&
      s.selection === 'ordered' &&
      s.representative === false &&
      s.limit === 20 &&
      s.totalRows === c.remaining &&
      Array.isArray(s.columns) &&
      s.columns.length === selected.length &&
      s.columns.every(
        (v: any, i: number) => v.name === selected[i] && v.type === columns.find(c => c.name === v.name)?.type,
      ),
  );
  assert(
    Array.isArray(s.rows) &&
      s.rows.length === Number(BigInt(c.remaining) > BigInt(20) ? BigInt(20) : BigInt(c.remaining)) &&
      s.hasMore === BigInt(c.remaining) > BigInt(s.rows.length),
  );
  const rows = s.rows.map((r: any) => {
    assert(
      Array.isArray(r.values) &&
        r.values.length === selected.length &&
        r.values.every(text) &&
        Array.isArray(r.truncated) &&
        r.truncated.length === selected.length &&
        r.truncated.every((v: unknown) => typeof v === 'boolean'),
    );
    return { values: r.values as Array<string | null>, truncated: r.truncated as boolean[] };
  });
  return {
    population: {
      ...c,
      matchedRatio: input.population.matchedRatio as number | null,
      remainingRatio: input.population.remainingRatio as number | null,
    },
    distributions,
    sample: {
      columns: s.columns as Array<{ name: string; type: string }>,
      rows,
      totalRows: c.remaining,
      hasMore: s.hasMore as boolean,
    },
  };
}
export type ConditionProfile = ReturnType<typeof readConditionProfile>;
