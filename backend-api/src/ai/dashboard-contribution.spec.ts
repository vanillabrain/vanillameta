import { compileContribution, contributionGroupFingerprint } from './dashboard-contribution';
import { buildTimeChartQuery } from './dashboard-trend';
import { validateSourceSql } from './dashboard-draft';

const schema = [
  { column_name: 'amount', column_type: 'DOUBLE' },
  { column_name: 'refund', column_type: 'DOUBLE' },
  { column_name: 'weight', column_type: 'DOUBLE' },
  { column_name: 'channel', column_type: 'VARCHAR' },
  { column_name: 'accepted', column_type: 'BOOLEAN' },
  { column_name: 'event_time', column_type: 'TIMESTAMP' },
];
const numeric = (expression: string, tail = 'WHERE accepted = true') => ({
  title: 'Metric',
  description: '',
  type: 'BOARD_NUMERIC',
  valueField: 'value',
  sql: `SELECT ${expression} AS value FROM source ${tail}`,
});
const chart = (category: string, tail = 'ORDER BY value DESC LIMIT 2') => ({
  ...numeric('sum(amount)'),
  type: 'CHART_COLUMN',
  categoryField: 'dimension',
  sql: `SELECT ${category} AS dimension, sum(amount) AS value FROM source WHERE accepted = true GROUP BY ${category} ${tail}`,
});

describe('aggregate input lineage compiler boundaries', () => {
  it('hashes typed group sets independently of order or duplicate categories', () => {
    expect(contributionGroupFingerprint([null, 'null', 1, '1', true])).toBe(
      contributionGroupFingerprint([true, '1', 1, 'null', null, null]),
    );
    expect(
      new Set([null, 'null', 1, '1', true].map(value => contributionGroupFingerprint([value])))
        .size,
    ).toBe(5);
    expect(contributionGroupFingerprint([])).toMatch(/^[a-f0-9]{64}$/);
    expect(contributionGroupFingerprint([undefined])).toBeUndefined();
    expect(contributionGroupFingerprint(Array(241).fill('x'))).toBeUndefined();
  });
  it.each(['categoryField', 'valueField'])('declines unsafe transport aliases in %s', field => {
    const widget = chart('channel');
    const alias = field === 'categoryField' ? 'dimension' : 'value';
    expect(
      compileContribution(
        { ...widget, [field]: '__proto__', sql: widget.sql.replace(`AS ${alias}`, 'AS __proto__') },
        schema,
      ).supported,
    ).toBe(false);
  });
  it('retains safe original magic-named columns inside aggregate arguments', () => {
    expect(
      compileContribution(numeric('sum("__proto__")'), [
        ...schema,
        { column_name: '__proto__', column_type: 'DOUBLE' },
      ]).supported,
    ).toBe(true);
  });
  it.each([
    'SELECT count(*) AS value FROM source WHERE ((amount) IS NOT NULL) AND ((accepted = true) OR NOT (refund IS NULL))',
    'SELECT CASE WHEN ((amount) IS NOT NULL) THEN (TRUE) ELSE (FALSE) END AS eligible FROM source WHERE (accepted = true)',
  ])('allows structural grouping in generated predicates: %s', sql => {
    expect(validateSourceSql(sql)).toBe(sql);
  });
  it.each([
    'SELECT count(*) AS value FROM source WHERE unknown_function(amount)',
    'SELECT CASE WHEN unknown_function(amount) THEN 1 ELSE 0 END AS value FROM source',
    'SELECT count(*) AS value FROM source WHERE "where"(amount)',
    'SELECT count(*) AS value FROM source WHERE (true) UNION SELECT count(*) FROM source',
  ])('retains function and relation boundaries: %s', sql => {
    expect(() => validateSourceSql(sql)).toThrow();
  });
  it.each(['sum', 'avg', 'count', 'min', 'max'])(
    'excludes NULL arguments for %s without discarding zero inputs',
    fn => {
      const plan = compileContribution(numeric(`${fn}(amount)`), schema);
      expect(plan).toMatchObject({
        supported: true,
        components: [`${fn.toUpperCase()}(amount)`],
        eligibility: ['((amount) IS NOT NULL)'],
        where: 'accepted = true',
      });
      expect(plan.supported && plan.semantics).toContain('0과 중복');
      expect(plan.supported && plan.semantics).toContain('모든 비NULL 입력');
    },
  );
  it('uses all rows for COUNT(*) and true predicate inputs for COUNT_IF', () => {
    expect(compileContribution(numeric('count(*)'), schema)).toMatchObject({
      supported: true,
      components: ['COUNT(*)'],
      eligibility: ['TRUE'],
    });
    expect(compileContribution(numeric('count_if(amount > 0)'), schema)).toMatchObject({
      supported: true,
      components: ['COUNT_IF(amount > 0)'],
      eligibility: ['((amount > 0) IS TRUE)'],
    });
  });
  it('tracks both ratio inputs and deduplicates the same aggregate', () => {
    expect(
      compileContribution(numeric('sum(refund) / nullif(sum(amount), 0) + sum(refund)'), schema),
    ).toMatchObject({
      supported: true,
      components: ['SUM(refund)', 'SUM(amount)'],
      eligibility: ['((refund) IS NOT NULL)', '((amount) IS NOT NULL)'],
    });
  });
  it('preserves CASE, weighted row expressions, scalar casts and original WHERE semantics', () => {
    const plan = compileContribution(
      numeric(
        'round(sum(CASE WHEN amount IS NOT NULL THEN amount * weight END) / nullif(sum(weight), 0), 2)',
        "WHERE accepted = true AND channel IN ('online', 'retail') AND amount BETWEEN -10 AND 100",
      ),
      schema,
    );
    expect(plan).toMatchObject({
      supported: true,
      components: ['SUM(CASE WHEN amount IS NOT NULL THEN amount * weight END)', 'SUM(weight)'],
    });
    expect(compileContribution(numeric('sum(try_cast(amount AS DOUBLE))'), schema).supported).toBe(
      true,
    );
    expect(
      compileContribution(numeric('CASE WHEN count(*) > 0 THEN avg(amount) ELSE 0 END'), schema)
        .supported,
    ).toBe(true);
    expect(compileContribution(numeric('sum(coalesce(amount, 0))'), schema)).toMatchObject({
      supported: true,
      eligibility: ['((coalesce ( amount , 0 )) IS NOT NULL)'],
    });
  });
  it('proves direct categorical top-N and NULL groups without dropping ORDER/LIMIT scope', () => {
    expect(compileContribution(chart('channel'), schema)).toMatchObject({
      supported: true,
      categoryExpression: '"channel"',
    });
    expect(compileContribution(chart('source.channel'), schema)).toMatchObject({
      supported: true,
      categoryExpression: '"channel"',
    });
  });
  it('proves generated temporal GROUP BY alias and rebuilt calendar query', () => {
    const definition = {
      ...chart("date_trunc('week', event_time)", 'ORDER BY dimension LIMIT 500'),
      type: 'CHART_LINE',
    };
    expect(
      compileContribution(
        {
          ...definition,
          sql: definition.sql.replace(
            "GROUP BY date_trunc('week', event_time)",
            'GROUP BY dimension',
          ),
        },
        schema,
      ),
    ).toMatchObject({ supported: true, categoryExpression: "date_trunc ( 'week' , event_time )" });
    const query = buildTimeChartQuery(definition.sql, 'value', 'dimension', 'event_time', 'month');
    expect(query).toBeDefined();
    if (!query) throw new Error('expected safe time query');
    expect(compileContribution({ ...definition, sql: query.sql }, schema)).toMatchObject({
      supported: true,
      categoryExpression:
        "strftime ( date_trunc ( 'month' , \"event_time\" ) , '%Y-%m-%dT%H:%M:%SZ' )",
    });
  });
  it.each([
    'sum(DISTINCT amount)',
    'count(DISTINCT channel)',
    'sum(amount) OVER ()',
    'sum(max(amount))',
    'amount',
    'sum(amount) + weight',
    'sum(unknown)',
    'sum(source.unknown)',
    'sum(another.amount)',
    'sum(amount, weight)',
    'sum(*)',
    'count()',
    'sum(amount) FILTER (WHERE accepted)',
    'sum(amount); DROP TABLE source',
    'sum(amount) /* comment */',
    "query('secret')",
    'sum(CASE WHEN accepted THEN amount)',
    'sum(CASE WHEN accepted THEN amount END) + 1 garbage',
    'sum(CASE amount END)',
  ])('declines unsupported or unsafe measure %s', expression => {
    expect(compileContribution(numeric(expression), schema)).toMatchObject({
      supported: false,
      reason: expect.stringContaining('안전'),
    });
  });
  it.each([
    'HAVING sum(amount)>0',
    'GROUP BY amount',
    'WHERE accepted OVER ()',
    'WHERE sum(amount)>0',
    "WHERE channel = 'online' UNION SELECT sum(amount) AS value FROM source",
    'ORDER BY amount',
    'LIMIT 1 OFFSET 1',
    'LIMIT 0',
    'LIMIT 9007199254740993',
    'WHERE accepted WHERE amount>0',
  ])('declines unsupported selection grammar %s', tail => {
    expect(compileContribution(numeric('sum(amount)', tail), schema).supported).toBe(false);
  });
  it.each([
    chart("CASE WHEN channel IS NULL THEN 'none' ELSE channel END"),
    chart('lower(channel)'),
    chart('event_time'),
    {
      ...chart('channel'),
      sql: chart('channel').sql.replace('GROUP BY channel', 'GROUP BY channel, accepted'),
    },
    {
      ...chart('channel'),
      sql: chart('channel').sql.replace('ORDER BY value', 'HAVING sum(amount)>0 ORDER BY value'),
    },
    { ...chart('channel'), sql: chart('channel').sql.replace('FROM source', 'FROM other') },
  ])('declines unproven category or query shape %#', widget =>
    expect(compileContribution(widget, schema).supported).toBe(false),
  );
});
