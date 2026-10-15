import { BadRequestException } from '@nestjs/common';
import { REUSE_RECIPE_MAX_BYTES, buildReuseRecipe, readReuseRecipe } from './reuse-recipe';

const columns = () => [
  { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false, nullCount: '0' },
  { name: 'channel', type: 'VARCHAR', numeric: false, temporal: false, nullCount: '0' },
  {
    name: 'day',
    type: 'DATE',
    numeric: false,
    temporal: true,
    nullCount: '0',
    min: '2020-01-01',
    max: '2020-02-01',
  },
];

const profile = (value = columns()) => ({
  sourceId: 7,
  supported: true,
  name: 'Owner source',
  dataVersion: 'v1',
  preview: [{ amount: 1, channel: 'A' }],
  columns: value,
});

/** The owner's saved analysis carries far more than a recipe may keep. */
const analysis = () => ({
  databaseId: 7,
  title: 'Owner analysis',
  explanation: '전체 기간 · 데스크톱',
  layoutSizes: [
    { width: 12, height: 3 },
    { width: 6, height: 5 },
  ],
  widgets: [
    {
      blockId: 'block-1',
      title: '매출',
      description: '합계',
      type: 'BOARD_NUMERIC',
      sql: 'SELECT SUM(amount) AS total FROM source',
      valueField: 'total',
    },
    {
      blockId: 'block-2',
      title: '채널',
      description: '',
      type: 'CHART_COLUMN',
      sql: 'SELECT channel, SUM(amount) AS total FROM source GROUP BY channel',
      valueField: 'total',
      categoryField: 'channel',
    },
  ],
  responsiveLayouts: {
    mobile: { 'block-1': { x: 0, y: 0, w: 4, h: 2 }, 'block-2': { x: 0, y: 2, w: 4, h: 2 } },
    tablet: { 'block-1': { x: 0, y: 0, w: 8, h: 2 }, 'block-2': { x: 0, y: 2, w: 8, h: 2 } },
    desktop: { 'block-1': { x: 0, y: 0, w: 12, h: 2 }, 'block-2': { x: 0, y: 2, w: 12, h: 2 } },
  },
  revision: 'r'.repeat(64),
  metrics: [{ id: 3, expression: 'SUM(amount)' }],
});

describe('UC-021 reuse recipe', () => {
  it('stores exactly the draft, the layouts, the redacted ids and the required columns', () => {
    const recipe = JSON.parse(buildReuseRecipe(analysis(), profile()));
    expect(Object.keys(recipe).sort()).toEqual(['analysis', 'profile', 'schemaVersion']);
    expect(recipe.schemaVersion).toBe(1);
    expect(recipe.analysis.databaseId).toBe(1);
    expect(recipe.profile.sourceId).toBe(1);
    expect(Object.keys(recipe.analysis).sort()).toEqual(
      ['databaseId', 'explanation', 'layoutSizes', 'responsiveLayouts', 'title', 'widgets'].sort(),
    );
    // Only the columns the SQL reads, in first-use order; trends autodetect the target
    // temporal column, so the owner's unread temporal column is not copied.
    expect(recipe.profile.columns).toEqual([
      { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false },
      { name: 'channel', type: 'VARCHAR', numeric: false, temporal: false },
    ]);
    expect(recipe.analysis.responsiveLayouts.desktop['block-2']).toEqual({
      x: 0,
      y: 2,
      w: 12,
      h: 2,
    });
  });

  it('drops source identity, statistics and captured rows', () => {
    const stored = buildReuseRecipe(analysis(), profile());
    for (const leak of [
      'Owner source',
      'dataVersion',
      'nullCount',
      'preview',
      'metrics',
      '"databaseId":7',
      'revision',
    ])
      expect(stored).not.toContain(leak);
  });

  it('round-trips through the reader used by the reuse API', () => {
    const stored = buildReuseRecipe(analysis(), profile());
    const { analysis: draft, profile: read } = readReuseRecipe(stored);
    expect(draft.databaseId).toBe(1);
    expect(draft.title).toBe('Owner analysis');
    expect(draft.widgets.map(widget => widget.blockId)).toEqual(['block-1', 'block-2']);
    expect(draft.responsiveLayouts.tablet['block-1']).toEqual({ x: 0, y: 0, w: 8, h: 2 });
    expect(read).toEqual({
      sourceId: 1,
      columns: [
        { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false },
        { name: 'channel', type: 'VARCHAR', numeric: false, temporal: false },
      ],
    });
    expect(readReuseRecipe(stored)).toEqual(
      readReuseRecipe(buildReuseRecipe(analysis(), profile())),
    );
  });

  it('keeps a partial legacy layout instead of inventing geometry', () => {
    const stored = buildReuseRecipe(
      { ...analysis(), responsiveLayouts: { desktop: { 'block-1': { x: 0, y: 0, w: 12, h: 2 } } } },
      profile(),
    );
    expect(JSON.parse(stored).analysis.responsiveLayouts).toEqual({
      desktop: { 'block-1': { x: 0, y: 0, w: 12, h: 2 } },
    });
    expect(readReuseRecipe(stored).analysis.responsiveLayouts.mobile).toBeUndefined();
  });

  it('refuses to build a recipe for an unsupported source or a broken layout', () => {
    expect(() => buildReuseRecipe(analysis(), { ...profile(), supported: false })).toThrow(
      BadRequestException,
    );
    expect(() =>
      buildReuseRecipe(
        {
          ...analysis(),
          responsiveLayouts: { desktop: { 'block-1': { x: '0', y: 0, w: 12, h: 2 } } },
        },
        profile(),
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      buildReuseRecipe(
        {
          ...analysis(),
          widgets: [{ ...analysis().widgets[0], sql: 'SELECT other AS total FROM source' }],
        },
        profile(),
      ),
    ).toThrow(BadRequestException);
  });

  it('refuses a recipe that is corrupted, oversized or carries a live source id', () => {
    const stored = buildReuseRecipe(analysis(), profile());
    expect(() => readReuseRecipe(undefined)).toThrow(BadRequestException);
    expect(() => readReuseRecipe('not json')).toThrow(BadRequestException);
    expect(() => readReuseRecipe(stored + ' '.repeat(REUSE_RECIPE_MAX_BYTES))).toThrow(
      BadRequestException,
    );
    expect(() => readReuseRecipe(JSON.stringify({ ...JSON.parse(stored), extra: 1 }))).toThrow(
      BadRequestException,
    );
    expect(() =>
      readReuseRecipe(JSON.stringify({ ...JSON.parse(stored), schemaVersion: 2 })),
    ).toThrow(BadRequestException);
    const live = JSON.parse(stored);
    live.analysis.databaseId = 7;
    expect(() => readReuseRecipe(JSON.stringify(live))).toThrow(BadRequestException);
    const liveProfile = JSON.parse(stored);
    liveProfile.profile.sourceId = 7;
    expect(() => readReuseRecipe(JSON.stringify(liveProfile))).toThrow(BadRequestException);
  });

  it('refuses a profile that does not match the stored SQL', () => {
    const padded = JSON.parse(buildReuseRecipe(analysis(), profile()));
    padded.profile.columns.push({ name: 'note', type: 'VARCHAR', numeric: false, temporal: false });
    expect(() => readReuseRecipe(JSON.stringify(padded))).toThrow(BadRequestException);
    const shortened = JSON.parse(buildReuseRecipe(analysis(), profile()));
    shortened.profile.columns = shortened.profile.columns.filter(
      (column: any) => column.name !== 'channel',
    );
    expect(() => readReuseRecipe(JSON.stringify(shortened))).toThrow(BadRequestException);
  });

  it('allows an empty column set for a COUNT(*) or literal-only draft', () => {
    const counted = {
      ...analysis(),
      layoutSizes: [{ width: 12, height: 3 }],
      widgets: [
        {
          blockId: 'block-1',
          title: '건수',
          description: '',
          type: 'BOARD_NUMERIC',
          sql: 'SELECT COUNT(*) AS total FROM source',
          valueField: 'total',
        },
      ],
      responsiveLayouts: { desktop: { 'block-1': { x: 0, y: 0, w: 12, h: 2 } } },
    };
    const stored = buildReuseRecipe(counted, profile());
    expect(JSON.parse(stored).profile).toEqual({ sourceId: 1, columns: [] });
    const read = readReuseRecipe(stored);
    expect(read.profile.columns).toEqual([]);
    expect(read.analysis.widgets[0].sql).toBe('SELECT COUNT(*) AS total FROM source');
    // An empty column set is only valid while the SQL really reads no source column.
    const tampered = JSON.parse(stored);
    tampered.analysis.widgets[0].sql = 'SELECT SUM(amount) AS total FROM source';
    expect(() => readReuseRecipe(JSON.stringify(tampered))).toThrow(BadRequestException);
  });

  it('reflects an edited original when the recipe is captured again', () => {
    const stored = buildReuseRecipe({ ...analysis(), title: '수정된 원본' }, profile());
    expect(readReuseRecipe(stored).analysis.title).toBe('수정된 원본');
  });
});
