import { resolveDimensionColumn } from './dashboard-dimension';

const sql = (category = '"channel"', group = category) =>
  `SELECT ${category} AS dimension, SUM(amount) AS value FROM source GROUP BY ${group} ORDER BY value DESC LIMIT 500`;
const columns = ['channel', 'amount', 'day', 'device type', 'quoted"name'];

describe('resolveDimensionColumn', () => {
  it.each([
    sql(),
    sql('channel'),
    sql('source.channel'),
    sql('source."channel"', '"channel"'),
    sql('"device type"'),
    sql('"quoted""name"'),
    sql('"channel"', 'source.channel'),
  ])('resolves the original column for %s', query => {
    const original = query.includes('device type')
      ? 'device type'
      : query.includes('quoted')
      ? 'quoted"name'
      : 'channel';
    expect(resolveDimensionColumn(query, 'dimension', columns, ['day'])).toBe(original);
  });
  it('supports unaliased categories, quoted category aliases and preserved WHERE literals', () => {
    expect(
      resolveDimensionColumn(
        'SELECT channel, sum(amount) AS value FROM source GROUP BY channel',
        'channel',
        columns,
        ['day'],
      ),
    ).toBe('channel');
    expect(
      resolveDimensionColumn(
        sql().replace('AS dimension', 'AS "category label"'),
        'category label',
        columns,
        ['day'],
      ),
    ).toBe('channel');
    expect(
      resolveDimensionColumn(
        sql().replace('FROM source', "FROM source WHERE channel = 'other group''s from'"),
        'dimension',
        columns,
        ['day'],
      ),
    ).toBe('channel');
  });
  it.each([
    sql('lower(channel)'),
    sql("CASE WHEN channel IS NULL THEN 'empty' ELSE channel END"),
    sql("channel || 'x'"),
    sql('amount + 1'),
    sql("coalesce(channel, 'missing')"),
    sql('day'),
    sql("date_trunc('day', day)"),
    sql('unknown_column'),
    sql('"channel"', 'dimension'),
    sql('"channel"', '"channel", day'),
    sql().replace('AS value', 'AS dimension'),
    sql().replace('AS value', 'AS DIMENSION'),
    sql().replace('SUM(amount) AS value', 'day AS other'),
    sql().replace('SUM(amount) AS value', 'SUM(amount) AS value, day AS other'),
    sql().replace('ORDER BY value', 'HAVING SUM(amount) > 1 ORDER BY value'),
    sql().replace('FROM source', 'FROM source s'),
    sql().replace('FROM source', 'FROM other'),
    sql() + '; DROP TABLE source',
    sql() + ' -- comment',
    sql().replace('FROM source', 'FROM source JOIN other ON true'),
    sql().replace('FROM source', 'FROM source UNION SELECT * FROM other'),
    sql().replace('SUM(amount)', "query('secret')"),
    sql().replace('SUM(amount)', 'SUM(amount) OVER ()'),
    sql('"channel"', '"channel" GROUP BY channel'),
  ])('declines computed, temporal, ambiguous or unsafe categories in %s', query => {
    expect(resolveDimensionColumn(query, 'dimension', columns, ['day'])).toBeUndefined();
  });
  it('does not guess a missing category or ambiguous schema name', () => {
    expect(resolveDimensionColumn(sql(), undefined, columns, ['day'])).toBeUndefined();
    expect(resolveDimensionColumn(sql(), 'value', columns, ['day'])).toBeUndefined();
    expect(resolveDimensionColumn(sql(), 'dimension', ['channel', 'CHANNEL'], [])).toBeUndefined();
  });
});
