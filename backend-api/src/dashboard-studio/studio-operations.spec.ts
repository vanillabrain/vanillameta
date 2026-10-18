import { readFileSync } from 'fs';
import { resolve } from 'path';
import { applyStudioOperation } from './studio-operations';
import { StudioBlock, StudioDocumentV1 } from './studio-contract';
const fixture = (): StudioDocumentV1 =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../fixtures/studio/document-v1.json'), 'utf8'));
const newId = 'new:00000000-0000-0000-0000-000000000001';
const newBlock = (kind: StudioBlock['kind'] = 'BOARD_NUMERIC'): StudioBlock => ({
  ...fixture().blocks[0],
  id: newId,
  kind,
});

describe('Studio pure operations', () => {
  it('UC052 applies detached scope and clears it without changing blocks or layouts', () => {
    const input = fixture();
    const conditions = {
      sourceRevision: 'a'.repeat(64),
      definition: {
        include: { kind: 'predicate', column: 'amount', operator: 'gte', values: [1] },
        exclude: null,
      },
    };
    const applied = applyStudioOperation(input, { type: 'setConditions', conditions });
    expect(applied.conditions).toEqual(conditions);
    expect(input.conditions).toBeUndefined();
    expect(applied.blocks).toEqual(input.blocks);
    expect(applied.layouts).toEqual(input.layouts);
    expect(
      applyStudioOperation(applied, { type: 'setConditions', conditions: null }).conditions,
    ).toBeUndefined();
  });
  const range = { column: 'event_time', start: '2026-01-01', end: '2026-01-02' };
  it('applies, replaces and removes the optional common date range', () => {
    const input = fixture();
    const applied = applyStudioOperation(input, { type: 'setDateRange', dateRange: range });
    expect(applied.dateRange).toEqual(range);
    expect(input.dateRange).toBeUndefined();
    const replaced = applyStudioOperation(applied, {
      type: 'setDateRange',
      dateRange: { ...range, start: '2025-12-31' },
    });
    expect(replaced.dateRange).toEqual({ ...range, start: '2025-12-31' });
    const cleared = applyStudioOperation(replaced, { type: 'setDateRange', dateRange: null });
    expect('dateRange' in cleared).toBe(false);
  });
  it.each([
    [{ column: 'event_time', start: '2026-01-02', end: '2026-01-01' }],
    [{ column: 'event_time', start: '2026-01-01' }],
    [{ column: 'event_time', start: '2026-01-01', end: '2026-01-01', precision: 'day' }],
    [{ column: 'event_time', start: '2026-01-01', end: '9999-12-31' }],
    ['2026-01-01'],
  ])('rejects a malformed range without mutating the document %#', dateRange => {
    const input = fixture();
    const before = fixture();
    expect(() => applyStudioOperation(input, { type: 'setDateRange', dateRange } as any)).toThrow();
    expect(input).toEqual(before);
  });
  it('rejects unknown or missing fields on a date range operation', () => {
    const input = fixture();
    expect(() =>
      applyStudioOperation(input, {
        type: 'setDateRange',
        dateRange: range,
        sql: 'SELECT 1',
      } as any),
    ).toThrow();
    expect(() => applyStudioOperation(input, { type: 'setDateRange' } as any)).toThrow();
  });
  it.each([
    ['BOARD_NUMERIC', [6, 4, 1], 3],
    ['CHART_COLUMN', [12, 8, 1], 5],
    ['CHART_BAR', [12, 8, 1], 5],
    ['CHART_LINE', [12, 8, 1], 5],
  ] as const)('appends %s using independent breakpoint bottoms', (kind, widths, h) => {
    const input = fixture();
    const block = newBlock(kind);
    const before = fixture();
    const result = applyStudioOperation(input, { type: 'addBlock', block });
    expect(result.blocks).toHaveLength(3);
    ['lg', 'md', 'xs'].forEach((bp, i) => {
      expect(result.layouts[bp].slice(0, 2)).toEqual(before.layouts[bp]);
      expect(result.layouts[bp][2]).toEqual({ id: newId, x: 0, y: [5, 5, 8][i], w: widths[i], h });
    });
    result.blocks[2].display.prefix = '$';
    expect(block.display.prefix).toBeUndefined();
    expect(input).toEqual(before);
  });
  it('duplicates original dimensions at each breakpoint and detaches nested refs', () => {
    const input = fixture();
    input.layouts.md[1].h = 7;
    const result = applyStudioOperation(input, { type: 'duplicateBlock', blockId: 'b2', newId });
    expect(result.blocks[2]).toEqual({ ...input.blocks[1], id: newId });
    expect(result.layouts.lg[2]).toEqual({ id: newId, x: 0, y: 5, w: 6, h: 5 });
    expect(result.layouts.md[2]).toEqual({ id: newId, x: 0, y: 7, w: 4, h: 7 });
    expect(result.layouts.xs[2]).toEqual({ id: newId, x: 0, y: 8, w: 1, h: 5 });
    result.blocks[2].dimensionRefs[0].key = 'other';
    expect(input.blocks[1].dimensionRefs[0].key).toBe('device_type');
    expect(result.blocks[1].dimensionRefs[0].key).toBe('device_type');
  });
  it('removes by identity with reordered layouts without shifting survivors', () => {
    const input = fixture();
    input.layouts.lg.reverse();
    const result = applyStudioOperation(input, { type: 'removeBlock', blockId: 'b1' });
    expect(result.blocks.map(b => b.id)).toEqual(['b2']);
    ['lg', 'md', 'xs'].forEach(bp =>
      expect(result.layouts[bp]).toEqual(input.layouts[bp].filter(g => g.id === 'b2')),
    );
  });
  it('updates only permitted content while preserving all layouts', () => {
    const input = fixture();
    const patch = {
      title: 'Updated',
      description: '',
      definitionKey: 'other',
      measureRefs: [],
      dimensionRefs: [],
      display: { prefix: '$' },
    };
    const result = applyStudioOperation(input, { type: 'updateBlock', blockId: 'b2', patch });
    expect(result.blocks[1]).toEqual({
      ...input.blocks[1],
      ...patch,
      display: { ...input.blocks[1].display, ...patch.display },
    });
    expect(result.blocks[0]).toEqual(input.blocks[0]);
    expect(result.layouts).toEqual(input.layouts);
    result.blocks[1].display.prefix = '!';
    expect(patch.display.prefix).toBe('$');
    expect(input).toEqual(fixture());
  });
  it('shallow merges display while replacing other patch fields', () => {
    const input = fixture();
    input.blocks[0].display.prefix = '$';
    const result = applyStudioOperation(input, {
      type: 'updateBlock',
      blockId: 'b1',
      patch: { display: { numberNotation: 'full' }, measureRefs: [] },
    });
    expect(result.blocks[0].display).toEqual({
      numberNotation: 'full',
      decimalPlaces: 0,
      prefix: '$',
    });
    expect(result.blocks[0].measureRefs).toEqual([]);
    expect(input.blocks[0].measureRefs).toEqual([{ id: 10, definitionVersion: 'metric-v1' }]);
    expect(input.blocks[0].display.numberNotation).toBe('compact');
  });
  it.each([null, undefined, [], { invalid: true }])(
    'rejects malformed display patches before merge %#',
    display => {
      expect(() =>
        applyStudioOperation(fixture(), { type: 'updateBlock', blockId: 'b1', patch: { display } }),
      ).toThrow();
    },
  );
  it('moves only the selected breakpoint and leaves other layout items unchanged', () => {
    const input = fixture();
    const result = applyStudioOperation(input, {
      type: 'moveBlock',
      blockId: 'b2',
      breakpoint: 'md',
      x: 0,
      y: 10,
    });
    expect(result.layouts.md[1]).toEqual({ id: 'b2', x: 0, y: 10, w: 4, h: 5 });
    expect(result.layouts.md[0]).toEqual(input.layouts.md[0]);
    expect(result.layouts.lg).toEqual(input.layouts.lg);
    expect(result.layouts.xs).toEqual(input.layouts.xs);
    expect(input).toEqual(fixture());
  });
  it('resizes only the selected breakpoint', () => {
    const input = fixture();
    const result = applyStudioOperation(input, {
      type: 'resizeBlock',
      blockId: 'b2',
      breakpoint: 'lg',
      w: 5,
      h: 9,
    });
    expect(result.layouts.lg[1]).toEqual({ id: 'b2', x: 6, y: 0, w: 5, h: 9 });
    expect(result.layouts.md).toEqual(input.layouts.md);
    expect(result.layouts.xs).toEqual(input.layouts.xs);
    expect(input).toEqual(fixture());
  });
  it('renames with detached results and accepts the title boundary', () => {
    const input = fixture();
    const result = applyStudioOperation(input, { type: 'renameDashboard', title: 'x'.repeat(300) });
    expect(result.title).toHaveLength(300);
    result.blocks[0].title = 'other';
    expect(input).toEqual(fixture());
  });
  it.each([
    { type: 'addBlock', block: { ...newBlock(), id: 'stored' } },
    { type: 'duplicateBlock', blockId: 'b1', newId: 'stored' },
    { type: 'duplicateBlock', blockId: 'missing', newId },
    { type: 'removeBlock', blockId: 'missing' },
    { type: 'removeBlock', blockId: 'b1', extra: true },
    { type: 'updateBlock', blockId: 'b1', patch: { id: 'other' } },
    { type: 'updateBlock', blockId: 'b1', patch: { kind: 'CHART_BAR' } },
    { type: 'updateBlock', blockId: 'b1', patch: { display: { sql: 'raw' } } },
    {
      type: 'updateBlock',
      blockId: 'b1',
      patch: { dimensionRefs: [{ key: 'device', sourceId: 8, schemaVersion: 'v1' }] },
    },
    { type: 'moveBlock', blockId: 'b2', breakpoint: 'lg', x: 0, y: 0 },
    { type: 'moveBlock', blockId: 'b2', breakpoint: 'xs', x: 0, y: Number.MAX_SAFE_INTEGER },
    { type: 'moveBlock', blockId: 'b2', breakpoint: 'md', x: 0.5, y: 5 },
    { type: 'moveBlock', blockId: 'b2', breakpoint: 'bad', x: 0, y: 5 },
    { type: 'resizeBlock', blockId: 'b1', breakpoint: 'lg', w: 7, h: 3 },
    { type: 'resizeBlock', blockId: 'b1', breakpoint: 'xs', w: 1, h: 4 },
    { type: 'resizeBlock', blockId: 'b1', breakpoint: 'lg', w: 1e100, h: 3 },
    { type: 'renameDashboard', title: ' ' },
    { type: 'renameDashboard', title: 'x'.repeat(301) },
    { type: 'renameDashboard', title: 'valid', rawSql: 'SELECT 1' },
    { type: 'unknown' },
    null,
  ])('rejects invalid operations atomically %#', operation => {
    const input = fixture();
    const before = JSON.stringify(operation);
    expect(() => applyStudioOperation(input, operation)).toThrow();
    expect(input).toEqual(fixture());
    expect(JSON.stringify(operation)).toBe(before);
  });
  it('adds to an empty draft at the origin of all breakpoints', () => {
    const input = fixture();
    input.blocks = [];
    input.layouts = { lg: [], md: [], xs: [] };
    const result = applyStudioOperation(input, { type: 'addBlock', block: newBlock('CHART_LINE') });
    expect(result.layouts).toEqual({
      lg: [{ id: newId, x: 0, y: 0, w: 12, h: 5 }],
      md: [{ id: newId, x: 0, y: 0, w: 8, h: 5 }],
      xs: [{ id: newId, x: 0, y: 0, w: 1, h: 5 }],
    });
  });
  it('rejects append overflow atomically', () => {
    const input = fixture();
    input.layouts.md[1].y = Number.MAX_SAFE_INTEGER - 5;
    const before = JSON.stringify(input);
    expect(() => applyStudioOperation(input, { type: 'addBlock', block: newBlock() })).toThrow();
    expect(() =>
      applyStudioOperation(input, { type: 'duplicateBlock', blockId: 'b1', newId }),
    ).toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([
    { type: 'addBlock', block: newBlock() },
    { type: 'duplicateBlock', blockId: 'b1', newId },
    { type: 'removeBlock', blockId: 'b1' },
    { type: 'updateBlock', blockId: 'b1', patch: { title: 'Changed' } },
    { type: 'moveBlock', blockId: 'b2', breakpoint: 'md', x: 0, y: 9 },
    { type: 'resizeBlock', blockId: 'b2', breakpoint: 'lg', w: 5, h: 4 },
    { type: 'renameDashboard', title: 'Changed' },
  ])('rejects extra keys on every operation variant %#', operation => {
    expect(() => applyStudioOperation(fixture(), { ...operation, unauthorized: true })).toThrow();
  });
  it('accepts frozen document and operation without writes', () => {
    function freeze(value: any): any {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
      return value;
    }
    const input = freeze(fixture());
    const operation = freeze({
      type: 'updateBlock',
      blockId: 'b1',
      patch: { display: { suffix: ' units' } },
    });
    const result = applyStudioOperation(input, operation);
    expect(result.blocks[0].display).toEqual({
      numberNotation: 'compact',
      decimalPlaces: 0,
      suffix: ' units',
    });
    expect(input).toEqual(fixture());
  });
  it('rejects a seventh block and duplicate temporary identities', () => {
    let input = fixture();
    for (let i = 1; i <= 4; i++)
      input = applyStudioOperation(input, {
        type: 'duplicateBlock',
        blockId: 'b1',
        newId: `new:00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      });
    expect(input.blocks).toHaveLength(6);
    const before = JSON.stringify(input);
    expect(() =>
      applyStudioOperation(input, {
        type: 'duplicateBlock',
        blockId: 'b1',
        newId: 'new:00000000-0000-0000-0000-000000000005',
      }),
    ).toThrow();
    expect(JSON.stringify(input)).toBe(before);
    expect(() =>
      applyStudioOperation(fixture(), { type: 'addBlock', block: newBlock() }),
    ).not.toThrow();
    const added = applyStudioOperation(fixture(), { type: 'addBlock', block: newBlock() });
    expect(() =>
      applyStudioOperation(added, { type: 'duplicateBlock', blockId: 'b1', newId }),
    ).toThrow();
  });
});
