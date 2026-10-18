import { BadRequestException, ConflictException } from '@nestjs/common';
import { sourceQuery, quoteColumn } from '../ai/dashboard-draft';
import { compileConditionDefinition, conditionColumns } from './source-condition-definition';

const KEYS = ['total', 'matched', 'excluded', 'remaining'] as const;
type Counts = Record<(typeof KEYS)[number], string>;
export function conditionPopulation(raw: any) {
  const counts = Object.fromEntries(KEYS.map(key => [key, String(raw?.[key])])) as Counts;
  if (
    KEYS.some(key => !/^\d{1,20}$/.test(counts[key])) ||
    BigInt(counts.matched) > BigInt(counts.total) ||
    BigInt(counts.excluded) + BigInt(counts.remaining) !== BigInt(counts.matched)
  )
    throw new ConflictException('집계 결과를 확인할 수 없습니다. 다시 조회해 주세요.');
  return {
    ...counts,
    matchedRatio: BigInt(counts.total) ? Number(counts.matched) / Number(counts.total) : null,
    remainingRatio: BigInt(counts.total) ? Number(counts.remaining) / Number(counts.total) : null,
  };
}
const aggregations = `COUNT(*) AS total, COUNT(*) FILTER (WHERE included) AS matched, COUNT(*) FILTER (WHERE included AND excluded) AS excluded, COUNT(*) FILTER (WHERE included AND NOT excluded) AS remaining`;
const projectedCounts = KEYS.map(key => `CAST(${key} AS VARCHAR) AS ${key}`).join(', ');
/** Validated native source only. No client SQL, random inference or unselected row fields. */
export async function sourceConditionProfile(input: {
  schema: Array<{ name: string; type: string }>;
  columns: unknown;
  definition: unknown;
  filters?: unknown;
  dateRange?: unknown;
  query: (sql: string, bindings: unknown[]) => Promise<{ datas: any[] }>;
}) {
  const schema = conditionColumns(input.schema);
  if (input.filters !== undefined && !Array.isArray(input.filters))
    throw new BadRequestException('공통 필터를 확인해 주세요.');
  if (
    !Array.isArray(input.columns) ||
    input.columns.length < 1 ||
    input.columns.length > 6 ||
    input.columns.some(name => typeof name !== 'string' || !name || name.length > 128) ||
    new Set(input.columns).size !== input.columns.length
  )
    throw new BadRequestException('조회할 열을 1~6개 선택해 주세요.');
  const columns = input.columns.map(name => {
    const column = schema.find(c => c.name === name);
    if (!column || column.kind === 'unsupported')
      throw new BadRequestException('분포와 표본을 지원하는 현재 열을 선택해 주세요.');
    return column;
  });
  const compiled = compileConditionDefinition(input.definition, schema);
  const evaluated = (projection: string) => {
    const marker = 'SELECT * FROM source';
    const base = sourceQuery(
      marker,
      schema.map(c => c.name),
      input.filters as any[],
      input.dateRange,
      schema.filter(c => ['date', 'timestamp'].includes(c.kind)).map(c => c.name),
      schema.filter(c => c.kind === 'number').map(c => c.name),
    );
    if (!base.sql.endsWith(marker))
      throw new BadRequestException('분포 범위를 구성하지 못했습니다.');
    // Generated compiler bindings are not client SQL and do not bypass the small user SELECT grammar.
    return {
      sql: `${base.sql.slice(0, -marker.length).trimEnd()}, evaluated AS (SELECT ${
        projection ? projection + ', ' : ''
      }(${compiled.includeSql}) AS included, (${compiled.excludeSql}) AS excluded FROM source)`,
      bindings: [...base.bindings, ...compiled.bindings],
    };
  };
  // Construct every query before the first population read, so malformed scope cannot fall back.
  const populationQuery = evaluated('');
  const distributionQueries = columns.map(column => {
    const source = evaluated(`${quoteColumn(column.name)} AS v`);
    return {
      ...source,
      sql: `${source.sql}, grouped AS (SELECT v, ${aggregations} FROM evaluated GROUP BY v), measured AS (SELECT *, MIN(v) OVER () AS lo, MAX(v) OVER () AS hi, COUNT(*) OVER () AS groups FROM grouped) SELECT CASE WHEN v IS NULL THEN NULL ELSE LEFT(CAST(v AS VARCHAR),200) END AS value, COALESCE(LENGTH(CAST(v AS VARCHAR))>200,FALSE) AS truncated, ${projectedCounts}, CAST(groups AS VARCHAR) AS groups, LEFT(CAST(lo AS VARCHAR),200) AS minimum, LEFT(CAST(hi AS VARCHAR),200) AS maximum, COALESCE(LENGTH(CAST(lo AS VARCHAR))>200,FALSE) AS minimumTruncated, COALESCE(LENGTH(CAST(hi AS VARCHAR))>200,FALSE) AS maximumTruncated FROM measured ORDER BY CAST(total AS HUGEINT) DESC, v ASC NULLS FIRST LIMIT 21`,
    };
  });
  const sampleProjection = columns
    .map((column, index) => `${quoteColumn(column.name)} AS "__vm_c${index}"`)
    .join(', ');
  const sampleQuery = evaluated(sampleProjection);
  const sampleSql = `${sampleQuery.sql} SELECT ${columns
    .flatMap((_, index) => [
      `LEFT(CAST("__vm_c${index}" AS VARCHAR),200) AS "c${index}"`,
      `COALESCE(LENGTH(CAST("__vm_c${index}" AS VARCHAR))>200,FALSE) AS "t${index}"`,
    ])
    .join(', ')} FROM evaluated WHERE included AND NOT excluded ORDER BY ${columns
    .map((_, index) => `"__vm_c${index}" ASC NULLS FIRST`)
    .join(', ')} LIMIT 20`;
  const population = conditionPopulation(
    (
      await input.query(
        `${populationQuery.sql} SELECT ${projectedCounts} FROM (SELECT ${aggregations} FROM evaluated)`,
        populationQuery.bindings,
      )
    ).datas[0],
  );
  const distributions = [];
  for (let index = 0; index < columns.length; index++) {
    const query = distributionQueries[index];
    const raw = (await input.query(query.sql, query.bindings)).datas;
    const rows = raw.slice(0, 20).map(row => {
      if (
        (row.value !== null &&
          (typeof row.value !== 'string' || Array.from(row.value).length > 200)) ||
        typeof row.truncated !== 'boolean'
      )
        throw new ConflictException('분포 값을 확인하지 못했습니다.');
      const population = conditionPopulation(row);
      const counts = Object.fromEntries(KEYS.map(key => [key, population[key]])) as Counts;
      return { value: row.value, valueTruncated: row.truncated, ...counts };
    });
    const other = Object.fromEntries(
      KEYS.map(key => [
        key,
        (
          BigInt(population[key]) - rows.reduce((sum, row) => sum + BigInt(row[key]), BigInt(0))
        ).toString(),
      ]),
    ) as Counts;
    conditionPopulation(other);
    const stats = raw[0];
    const totalGroups = stats ? String(stats.groups) : '0';
    if (!/^\d{1,20}$/.test(totalGroups) || BigInt(totalGroups) < BigInt(rows.length))
      throw new ConflictException('분포 그룹 수를 확인하지 못했습니다.');
    distributions.push({
      column: columns[index].name,
      type: columns[index].type,
      rows,
      other,
      limit: 20,
      totalGroups,
      hasMore: BigInt(totalGroups) > BigInt(20),
      range: {
        minimum: stats?.minimum ?? null,
        maximum: stats?.maximum ?? null,
        minimumTruncated: stats?.minimumTruncated ?? false,
        maximumTruncated: stats?.maximumTruncated ?? false,
      },
    });
  }
  const rawSamples = (await input.query(sampleSql, sampleQuery.bindings)).datas;
  const rows = rawSamples.map(row => ({
    values: columns.map((_, index) => row['c' + index]),
    truncated: columns.map((_, index) => row['t' + index]),
  }));
  if (
    rows.length !==
      Number(
        BigInt(population.remaining) > BigInt(20) ? BigInt(20) : BigInt(population.remaining),
      ) ||
    rows.some(
      row =>
        row.values.some(
          value => value !== null && (typeof value !== 'string' || Array.from(value).length > 200),
        ) || row.truncated.some(value => typeof value !== 'boolean'),
    )
  )
    throw new ConflictException('표본 범위를 확인하지 못했습니다.');
  const result = {
    population,
    distributions,
    sample: {
      columns: columns.map(({ name, type }) => ({ name, type })),
      rows,
      limit: 20,
      totalRows: population.remaining,
      hasMore: BigInt(population.remaining) > BigInt(rows.length),
      selection: 'ordered' as const,
      representative: false,
    },
  };
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 256 * 1024)
    throw new BadRequestException('결과가 큽니다. 선택 열을 줄여 다시 조회해 주세요.');
  return result;
}
