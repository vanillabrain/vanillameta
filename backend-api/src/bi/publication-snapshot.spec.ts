import { BadRequestException } from '@nestjs/common';
import {
  PUBLICATION_MAX_TREND_POINTS,
  buildPublicationSnapshot,
  sanitizePublicationWidget,
} from './publication-snapshot';

const layout = (blocks: string[]) => ({
  mobile: Object.fromEntries(blocks.map((id, i) => [id, { x: 0, y: i * 3, w: 4, h: 2 }])),
  tablet: Object.fromEntries(blocks.map((id, i) => [id, { x: 0, y: i * 3, w: 8, h: 2 }])),
  desktop: Object.fromEntries(blocks.map((id, i) => [id, { x: 0, y: i * 3, w: 12, h: 2 }])),
});
/** Every publishable block carries the server-side aggregate proof from the editor preview. */
const widget = (over: any = {}) => ({
  blockId: 'block-1',
  title: '매출',
  description: '설명',
  type: 'BOARD_NUMERIC',
  sql: 'SELECT SUM(amount) AS total FROM source',
  valueField: 'total',
  contribution: { supported: true, components: [] },
  decimalPlaces: 2,
  numberNotation: 'compact',
  prefix: '',
  suffix: '',
  databaseId: 7,
  filePath: '/tmp/private.duckdb',
  connectionConfig: 'encrypted-token',
  queries: [{ kind: 'widget', sql: 'SELECT SUM(amount) FROM source' }],
  datas: [{ total: 12, os: 'iOS', internal_note: 'secret' }],
  trend: {
    column: 'day',
    grain: 'day',
    points: [{ time: '2023-09-09', value: 12, contribution: 'x' }],
    timeSelection: { column: 'day' },
  },
  ...over,
});
const chart = (over: any = {}) =>
  widget({
    type: 'CHART_COLUMN',
    categoryField: 'os',
    datas: [{ total: 5, os: 'iOS', hidden: 'x' }],
    trend: undefined,
    ...over,
  });
const build = (over: any = {}) =>
  buildPublicationSnapshot({
    title: '게시 분석',
    widgets: [widget()],
    responsiveLayouts: layout(['block-1']),
    capturedAt: new Date('2026-10-15T00:00:00.000Z'),
    ...over,
  });

describe('publication snapshot sanitizer', () => {
  it('projects only the allowlisted fields for a numeric block and never leaks source detail', () => {
    const { snapshot } = build();
    const serialized = JSON.stringify(snapshot);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.title).toBe('게시 분석');
    expect(snapshot.capturedAt).toBe('2026-10-15T00:00:00.000Z');
    expect(snapshot.scope).toContain('UTC');
    expect(snapshot.responsiveLayouts.desktop['block-1']).toEqual({ x: 0, y: 0, w: 12, h: 2 });
    expect(Object.keys(snapshot.responsiveLayouts)).toEqual(['mobile', 'tablet', 'desktop']);
    expect(snapshot.widgets[0]).toEqual({
      blockId: 'block-1',
      title: '매출',
      description: '설명',
      type: 'BOARD_NUMERIC',
      valueField: 'total',
      prefix: '',
      suffix: '',
      decimalPlaces: 2,
      numberNotation: 'compact',
      datas: [{ total: 12 }],
      trend: { column: 'day', grain: 'day', points: [{ time: '2023-09-09', value: 12 }] },
    });
    expect(snapshot.widgets[0]).not.toHaveProperty('categoryField');
    expect(snapshot.widgets[0].datas[0]).not.toHaveProperty('internal_note');
    expect(snapshot.widgets[0].datas[0]).not.toHaveProperty('os');
    expect(snapshot.widgets[0].trend?.points[0]).not.toHaveProperty('contribution');
    expect(snapshot.widgets[0].trend).not.toHaveProperty('timeSelection');
    for (const leak of ['SELECT', 'SUM(', 'databaseId', 'filePath', 'queries', 'connectionConfig'])
      expect(serialized).not.toContain(leak);
  });

  it('keeps the selected value and category columns for charts and requires both', () => {
    const projected = sanitizePublicationWidget(chart());
    expect(projected.datas).toEqual([{ total: 5, os: 'iOS' }]);
    expect(projected.categoryField).toBe('os');
    expect(projected).not.toHaveProperty('trend');
    expect(() => sanitizePublicationWidget(chart({ datas: [{ total: 5 }] }))).toThrow(
      BadRequestException,
    );
    expect(() => sanitizePublicationWidget(chart({ categoryField: undefined }))).toThrow(
      BadRequestException,
    );
  });

  it('refuses blocks without the server aggregate proof or without one numeric row', () => {
    expect(() => sanitizePublicationWidget(widget({ contribution: undefined }))).toThrow(
      BadRequestException,
    );
    expect(() =>
      sanitizePublicationWidget(widget({ contribution: { supported: false, reason: 'x' } })),
    ).toThrow(BadRequestException);
    expect(() =>
      sanitizePublicationWidget(widget({ datas: [{ total: 1 }, { total: 2 }] })),
    ).toThrow(BadRequestException);
    expect(() => sanitizePublicationWidget(widget({ datas: [] }))).toThrow(BadRequestException);
  });

  it('never lets reserved names become row keys or widget columns', () => {
    const polluted = JSON.parse('{"total": 1, "__proto__": {"polluted": true}}');
    const projected = sanitizePublicationWidget(widget({ datas: [polluted] }));
    expect(Object.keys(projected.datas[0])).toEqual(['total']);
    expect(({} as any).polluted).toBeUndefined();
    for (const column of ['__proto__', 'constructor', 'prototype']) {
      expect(() => sanitizePublicationWidget(chart({ valueField: column }))).toThrow(
        BadRequestException,
      );
      expect(() => sanitizePublicationWidget(chart({ categoryField: column }))).toThrow(
        BadRequestException,
      );
    }
  });

  it('rejects unusable block shapes instead of defaulting them', () => {
    expect(() => sanitizePublicationWidget(widget({ blockId: undefined }))).toThrow(
      BadRequestException,
    );
    expect(() => sanitizePublicationWidget(widget({ type: 'PIE' }))).toThrow(BadRequestException);
    expect(() => sanitizePublicationWidget(widget({ datas: [{ other: 1 }] }))).toThrow(
      BadRequestException,
    );
    expect(() =>
      sanitizePublicationWidget(widget({ trend: { column: 'day', grain: 'year', points: [] } })),
    ).toThrow(BadRequestException);
    expect(() => sanitizePublicationWidget(widget({ decimalPlaces: 9 }))).toThrow(
      BadRequestException,
    );
  });

  it('rejects a snapshot that exceeds the row, trend point and byte caps', () => {
    const rows = Array.from({ length: 2001 }, (_v, i) => ({ total: i, os: 'iOS' }));
    expect(() => build({ widgets: [chart({ datas: rows })] })).toThrow(BadRequestException);
    const points = Array.from({ length: PUBLICATION_MAX_TREND_POINTS + 1 }, (_v, i) => ({
      time: `2023-09-${i}`,
      value: i,
    }));
    expect(() =>
      build({ widgets: [widget({ trend: { column: 'day', grain: 'day', points } })] }),
    ).toThrow(BadRequestException);
    const heavy = Array.from({ length: 2000 }, () => ({ total: 'x'.repeat(600), os: 'iOS' }));
    expect(() => build({ widgets: [chart({ datas: heavy })] })).toThrow(BadRequestException);
  });

  it('requires every breakpoint rect for every block and rejects overlaps', () => {
    const missingTablet = layout(['block-1']);
    delete (missingTablet as any).tablet;
    expect(() => build({ responsiveLayouts: missingTablet })).toThrow(BadRequestException);
    const missingBlock = layout(['block-1']);
    delete (missingBlock.desktop as any)['block-1'];
    expect(() => build({ responsiveLayouts: missingBlock })).toThrow(BadRequestException);
    const outOfRange = layout(['block-1']);
    outOfRange.mobile['block-1'] = { x: 3, y: 0, w: 4, h: 2 };
    expect(() => build({ responsiveLayouts: outOfRange })).toThrow(BadRequestException);
    const overlapping = {
      mobile: { 'block-1': { x: 0, y: 0, w: 4, h: 2 }, 'block-2': { x: 0, y: 1, w: 4, h: 2 } },
      tablet: { 'block-1': { x: 0, y: 0, w: 8, h: 2 }, 'block-2': { x: 0, y: 2, w: 8, h: 2 } },
      desktop: { 'block-1': { x: 0, y: 0, w: 12, h: 2 }, 'block-2': { x: 0, y: 2, w: 12, h: 2 } },
    };
    expect(() =>
      build({
        widgets: [widget(), chart({ blockId: 'block-2' })],
        responsiveLayouts: overlapping,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects duplicate block ids and empty widget sets', () => {
    expect(() => build({ widgets: [] })).toThrow(BadRequestException);
    expect(() => build({ widgets: [widget(), widget()] })).toThrow(BadRequestException);
    expect(() => build({ title: '   ' })).toThrow(BadRequestException);
  });
});
