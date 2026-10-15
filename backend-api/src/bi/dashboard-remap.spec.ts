import { DashboardDraft } from '../ai/dashboard-draft';
import {
  compatibleReuseColumn,
  remapDashboard,
  ReuseColumn,
  ReuseSourceProfile,
  reuseColumns,
} from './dashboard-remap';

const source: ReuseSourceProfile = {
  sourceId: 1,
  columns: [
    { name: 'device_os', type: 'VARCHAR' },
    { name: 'bid_request_cnt', type: 'BIGINT' },
    { name: 'bid_floor', type: 'DOUBLE' },
    { name: 'has_bid_floor_cnt', type: 'BIGINT' },
    { name: 'region', type: 'VARCHAR' },
    { name: 'created_at', type: 'TIMESTAMP' },
    { name: 'unused_metric', type: 'DOUBLE' },
  ],
};

const target: ReuseSourceProfile = {
  sourceId: 9,
  columns: [
    { name: 'os', type: 'VARCHAR' },
    { name: 'requests', type: 'BIGINT' },
    { name: 'floor_price', type: 'DOUBLE' },
    { name: 'has_floor_cnt', type: 'BIGINT' },
    { name: 'region', type: 'VARCHAR' },
    { name: 'event_at', type: 'TIMESTAMP' },
    { name: 'event_day', type: 'DATE' },
  ],
};

const widget = (
  over: Partial<DashboardDraft['widgets'][number]> = {},
): DashboardDraft['widgets'][number] => ({
  title: '위젯',
  description: '',
  type: 'BOARD_NUMERIC',
  sql: 'SELECT COUNT(*) AS value FROM source',
  valueField: 'value',
  ...over,
});

const draft = (widgets: DashboardDraft['widgets']): DashboardDraft => ({
  databaseId: 1,
  title: '원본 대시보드',
  explanation: '설명',
  widgets,
});

const CHART_SQL =
  'SELECT device_os, SUM(bid_request_cnt) AS total_requests FROM source GROUP BY device_os ORDER BY total_requests DESC';

describe('UC-020 dashboard column remap', () => {
  it('reports only the source columns the SQL uses, in first-use order', () => {
    expect(
      reuseColumns(
        draft([
          widget({
            type: 'CHART_COLUMN',
            sql: CHART_SQL,
            valueField: 'total_requests',
            categoryField: 'device_os',
          }),
          widget({
            sql: 'SELECT SUM(bid_request_cnt) AS total_requests, SUM(bid_floor) / SUM(has_bid_floor_cnt) AS avg_bid_floor FROM source',
            valueField: 'avg_bid_floor',
          }),
        ]),
        source,
      ),
    ).toEqual([
      { name: 'device_os', type: 'VARCHAR', numeric: false, temporal: false },
      { name: 'bid_request_cnt', type: 'BIGINT', numeric: true, temporal: false },
      { name: 'bid_floor', type: 'DOUBLE', numeric: true, temporal: false },
      { name: 'has_bid_floor_cnt', type: 'BIGINT', numeric: true, temporal: false },
    ]);
  });

  it('remaps the Rill-style ratio and keeps every output alias', () => {
    const result = remapDashboard(
      draft([
        widget({
          type: 'CHART_COLUMN',
          sql: CHART_SQL,
          valueField: 'total_requests',
          categoryField: 'device_os',
        }),
        widget({
          sql: 'SELECT SUM(bid_floor) / SUM(has_bid_floor_cnt) AS avg_bid_floor FROM source',
          valueField: 'avg_bid_floor',
        }),
      ]),
      source,
      target,
      {
        device_os: 'os',
        bid_request_cnt: 'requests',
        bid_floor: 'floor_price',
        has_bid_floor_cnt: 'has_floor_cnt',
      },
    );
    expect(result.databaseId).toBe(9);
    expect(result.widgets[0].sql).toBe(
      'SELECT "os" AS "device_os", SUM("requests") AS total_requests FROM source GROUP BY "os" ORDER BY total_requests DESC',
    );
    expect(result.widgets[0].categoryField).toBe('device_os');
    expect(result.widgets[0].valueField).toBe('total_requests');
    expect(result.widgets[1].sql).toBe(
      'SELECT SUM("floor_price") / SUM("has_floor_cnt") AS avg_bid_floor FROM source',
    );
  });

  it('preserves title, layout, block identity and display options', () => {
    const result = remapDashboard(
      {
        databaseId: 1,
        title: '매출',
        explanation: 'e',
        layoutSizes: [{ width: 6, height: 3 }],
        widgets: [
          widget({
            blockId: 'b1',
            title: '총 요청',
            description: 'd',
            sql: 'SELECT SUM(bid_request_cnt) AS total_requests FROM source',
            valueField: 'total_requests',
            decimalPlaces: 2,
            prefix: '$',
            suffix: '건',
            numberNotation: 'compact',
          }),
        ],
      },
      source,
      target,
      { bid_request_cnt: 'requests' },
    );
    expect(result).toMatchObject({ title: '매출', explanation: 'e', databaseId: 9 });
    expect(result.layoutSizes).toEqual([{ width: 6, height: 3 }]);
    expect(result.widgets[0]).toEqual({
      blockId: 'b1',
      title: '총 요청',
      description: 'd',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT SUM("requests") AS total_requests FROM source',
      valueField: 'total_requests',
      decimalPlaces: 2,
      prefix: '$',
      suffix: '건',
      numberNotation: 'compact',
    });
  });

  it('leaves the statement untouched when the mapping keeps the same names', () => {
    const result = remapDashboard(
      draft([
        widget({
          type: 'CHART_COLUMN',
          sql: CHART_SQL,
          valueField: 'total_requests',
          categoryField: 'device_os',
        }),
      ]),
      source,
      source,
      { device_os: 'device_os', bid_request_cnt: 'bid_request_cnt' },
    );
    expect(result.widgets[0].sql).toBe(CHART_SQL);
  });

  it('matches mapping keys and SQL identifiers case-insensitively', () => {
    const result = remapDashboard(
      draft([widget({ sql: 'SELECT SUM(BID_REQUEST_CNT) AS value FROM source' })]),
      source,
      target,
      { BID_Request_Cnt: 'requests' },
    );
    expect(result.widgets[0].sql).toBe('SELECT SUM("requests") AS value FROM source');
  });

  it('handles a qualified reference and a quoted identifier with escaped quotes', () => {
    const odd: ReuseSourceProfile = {
      sourceId: 3,
      columns: [
        { name: 'source', type: 'DOUBLE' },
        { name: 'a"b', type: 'DOUBLE' },
        { name: 'Amount', type: 'DECIMAL(18,4)' },
      ],
    };
    const oddTarget: ReuseSourceProfile = {
      sourceId: 4,
      columns: [
        { name: 'c"d', type: 'DOUBLE' },
        { name: 'total_amount', type: 'DOUBLE' },
      ],
    };
    const result = remapDashboard(
      draft([
        widget({
          sql: 'SELECT source."a""b" AS value, "Amount" AS other FROM source',
          valueField: 'value',
          categoryField: 'other',
        }),
      ]),
      odd,
      oddTarget,
      { 'A"B': 'c"d', Amount: 'total_amount' },
    );
    expect(result.widgets[0].sql).toBe(
      'SELECT source."c""d" AS value, "total_amount" AS other FROM source',
    );
  });

  it('keeps CAST types, WHERE literals and date units intact', () => {
    const result = remapDashboard(
      draft([
        widget({
          sql: "SELECT CAST(SUM(bid_floor) AS DOUBLE) AS value FROM source WHERE region = 'KR' AND device_os <> 'ios'",
        }),
        widget({
          type: 'CHART_LINE',
          sql: "SELECT STRFTIME(created_at, '%Y-%m') AS bucket, DATE_TRUNC('day', created_at) AS day_bucket, SUM(bid_request_cnt) AS value FROM source GROUP BY bucket, day_bucket ORDER BY bucket",
          categoryField: 'bucket',
        }),
      ]),
      source,
      target,
      {
        bid_floor: 'floor_price',
        region: 'region',
        device_os: 'os',
        created_at: 'event_at',
        bid_request_cnt: 'requests',
      },
    );
    expect(result.widgets[0].sql).toBe(
      'SELECT CAST(SUM("floor_price") AS DOUBLE) AS value FROM source WHERE region = \'KR\' AND "os" <> \'ios\'',
    );
    expect(result.widgets[1].sql).toBe(
      'SELECT STRFTIME("event_at", \'%Y-%m\') AS bucket, DATE_TRUNC(\'day\', "event_at") AS day_bucket, SUM("requests") AS value FROM source GROUP BY bucket, day_bucket ORDER BY bucket',
    );
  });

  it('allows DATE to DATE and rejects DATE to TIMESTAMP', () => {
    const daySource: ReuseSourceProfile = {
      sourceId: 1,
      columns: [{ name: 'event_day', type: 'DATE' }],
    };
    const dayTarget: ReuseSourceProfile = {
      sourceId: 3,
      columns: [{ name: 'created_day', type: 'DATE' }],
    };
    const stampTarget: ReuseSourceProfile = {
      sourceId: 2,
      columns: [{ name: 'event_at', type: 'TIMESTAMP' }],
    };
    const dayDraft = draft([
      widget({
        type: 'CHART_LINE',
        sql: 'SELECT event_day, COUNT(*) AS value FROM source GROUP BY event_day',
        categoryField: 'event_day',
      }),
    ]);
    expect(
      remapDashboard(dayDraft, daySource, dayTarget, { event_day: 'created_day' }).widgets[0].sql,
    ).toBe(
      'SELECT "created_day" AS "event_day", COUNT(*) AS value FROM source GROUP BY "created_day"',
    );
    expect(() =>
      remapDashboard(dayDraft, daySource, stampTarget, { event_day: 'event_at' }),
    ).toThrow('incompatible target column');
  });

  it('treats a draft that reads no column as an empty mapping', () => {
    const countDraft = draft([widget({ sql: 'SELECT COUNT(*) AS value FROM source' })]);
    expect(reuseColumns(countDraft, source)).toEqual([]);
    const empty = { sourceId: 1, columns: [] };
    expect(reuseColumns(countDraft, empty)).toEqual([]);
    expect(remapDashboard(countDraft, empty, target, {}).widgets[0].sql).toBe(
      'SELECT COUNT(*) AS value FROM source',
    );
    expect(() =>
      reuseColumns(draft([widget({ sql: 'SELECT SUM(missing) AS value FROM source' })]), empty),
    ).toThrow();
    const result = remapDashboard(countDraft, source, target, {});
    expect(result.widgets[0].sql).toBe('SELECT COUNT(*) AS value FROM source');
    expect(result.databaseId).toBe(9);
  });

  it('rejects a mapping that is missing, extra or not a string', () => {
    const one = draft([widget({ sql: 'SELECT SUM(bid_floor) AS value FROM source' })]);
    expect(() => remapDashboard(one, source, target, {})).toThrow('missing column mapping');
    expect(() =>
      remapDashboard(one, source, target, { bid_floor: 'floor_price', mystery: 'requests' }),
    ).toThrow('unsupported column mapping');
    expect(() => remapDashboard(one, source, target, { bid_floor: 5 } as any)).toThrow(
      'invalid column mapping',
    );
    expect(() => remapDashboard(one, source, target, { bid_floor: 'nope' })).toThrow(
      'unknown target column',
    );
    expect(() => remapDashboard(one, source, target, { bid_floor: 'event_at' })).toThrow(
      'incompatible target column',
    );
  });

  it('rejects an ambiguous alias/source collision and unknown identifiers', () => {
    const collisions: ReuseSourceProfile = {
      sourceId: 1,
      columns: [
        { name: 'amount', type: 'DOUBLE' },
        { name: 'total', type: 'DOUBLE' },
      ],
    };
    const ambiguous = draft([widget({ sql: 'SELECT amount AS total FROM source GROUP BY total' })]);
    expect(() => remapDashboard(ambiguous, collisions, collisions, {})).toThrow(
      'ambiguous column reference',
    );
    const unknown = draft([widget({ sql: 'SELECT mystery FROM source' })]);
    expect(() => remapDashboard(unknown, source, target, {})).toThrow('unsupported SQL identifier');
    const aliased = draft([widget({ sql: 'SELECT other.bid_floor FROM source' })]);
    expect(() => remapDashboard(aliased, source, target, {})).toThrow(
      'only source relation is allowed',
    );
    const duplicated: ReuseSourceProfile = {
      sourceId: 1,
      columns: [
        { name: 'amount', type: 'DOUBLE' },
        { name: 'AMOUNT', type: 'DOUBLE' },
      ],
    };
    expect(() => reuseColumns(unknown, duplicated)).toThrow('ambiguous source profile column');
  });

  it('rejects an unsupported statement before reading any column', () => {
    const joined = draft([
      widget({ sql: 'SELECT SUM(bid_floor) AS value FROM source JOIN other ON true' }),
    ]);
    expect(() => reuseColumns(joined, source)).toThrow();
  });

  it('rejects an EXTRACT-style draft the existing validator cannot accept', () => {
    const extracted = draft([
      widget({ sql: 'SELECT EXTRACT(YEAR FROM created_at) AS bucket FROM source' }),
    ]);
    expect(() => reuseColumns(extracted, source)).toThrow('only source relation is allowed');
  });

  it('compares reuse compatibility by exact column type, never by guess', () => {
    const column = (name: string, type: string): ReuseColumn => ({
      name,
      type,
      numeric:
        /^(?:U?BIGINT|U?INTEGER|U?SMALLINT|U?TINYINT|HUGEINT|FLOAT|DOUBLE|REAL|DECIMAL|NUMERIC)/i.test(
          type,
        ),
      temporal: /^(?:DATE|TIMESTAMP)/i.test(type),
    });
    expect(compatibleReuseColumn(column('a', 'DOUBLE'), column('b', 'DECIMAL(18,4)'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'BIGINT'), column('b', 'FLOAT'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'VARCHAR'), column('b', 'TEXT'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'VARCHAR'), column('b', 'VARCHAR(255)'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'NVARCHAR'), column('b', 'TEXT'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'BPCHAR'), column('b', 'BPCHAR'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'VARCHAR[]'), column('b', 'VARCHAR'))).toBe(false);
    expect(compatibleReuseColumn(column('a', 'VARCHAR[]'), column('b', 'TEXT'))).toBe(false);
    expect(compatibleReuseColumn(column('a', 'VARCHAR[]'), column('b', 'VARCHAR[]'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'DATE'), column('b', 'DATE'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'TIMESTAMP'), column('b', 'TIMESTAMP'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'TIMESTAMP'), column('b', 'TIMESTAMPTZ'))).toBe(false);
    expect(compatibleReuseColumn(column('a', 'TIMESTAMP'), column('b', 'TIMESTAMP_NS'))).toBe(
      false,
    );
    expect(compatibleReuseColumn(column('a', 'TIMESTAMPTZ'), column('b', 'TIMESTAMPTZ'))).toBe(
      true,
    );
    expect(compatibleReuseColumn(column('a', 'DATE'), column('b', 'TIMESTAMP'))).toBe(false);
    expect(compatibleReuseColumn(column('a', 'TIMESTAMP'), column('b', 'DATE'))).toBe(false);
    expect(compatibleReuseColumn(column('a', 'DOUBLE'), column('b', 'VARCHAR'))).toBe(false);
    expect(compatibleReuseColumn(column('a', 'VARCHAR'), column('b', 'BIGINT'))).toBe(false);
    expect(compatibleReuseColumn(column('a', 'JSON'), column('b', 'JSON'))).toBe(true);
    expect(compatibleReuseColumn(column('a', 'JSON'), column('b', 'VARCHAR'))).toBe(false);
    expect(compatibleReuseColumn(column('a', 'BOOLEAN'), column('b', 'BOOL'))).toBe(false);
  });

  it('honours an explicit numeric flag instead of the type name', () => {
    const flagged: ReuseColumn = {
      name: 'amount',
      type: 'NUMERIC(10,2)',
      numeric: false,
      temporal: false,
    };
    const numeric: ReuseColumn = {
      name: 'total',
      type: 'NUMERIC(10,2)',
      numeric: true,
      temporal: false,
    };
    expect(compatibleReuseColumn(flagged, numeric)).toBe(false);
  });
});
