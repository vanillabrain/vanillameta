import { BadRequestException, ConflictException } from '@nestjs/common';
import { compileSemanticProposal, semanticCatalog, metricIdentity } from './semantic-proposal';

export const profile = {
  sourceId: 7,
  supported: true,
  dataVersion: 'v1',
  columns: [
    { name: 'bid_request_cnt', type: 'BIGINT', numeric: true, temporal: false },
    { name: 'bid_floor', type: 'DOUBLE', numeric: true, temporal: false },
    { name: 'has_bid_floor_cnt', type: 'BIGINT', numeric: true, temporal: false },
    { name: 'device_os', type: 'VARCHAR', numeric: false, temporal: false },
    { name: 'time', type: 'TIMESTAMP', numeric: false, temporal: true },
  ],
};
export const definition = {
  label: '요청 수',
  aggregation: 'SUM',
  column: 'bid_request_cnt',
  unit: '',
  decimalPlaces: 0,
  numberNotation: 'compact',
};
export const proposal = () => ({
  schemaVersion: 1,
  sourceId: 7,
  sourceRevision: 'v1',
  title: '입찰 분석',
  measures: [{ key: 'requests', definition: { ...definition } }],
  dimensions: [{ key: 'os', column: 'device_os' }],
  blocks: [
    { key: 'total', measureKey: 'requests', chart: 'number', title: '전체 요청' },
    {
      key: 'breakdown',
      measureKey: 'requests',
      dimensionKey: 'os',
      chart: 'bar',
      title: 'OS별 요청',
    },
  ],
});
const row = (id = 11, overrides = {}) => ({
  id,
  databaseId: 7,
  useYn: 'Y',
  definition: JSON.stringify({
    schemaVersion: 1,
    definitionVersion: 2,
    sourceId: 7,
    tableName: 'uploaded_data',
    ...definition,
  }),
  ...overrides,
});
const compile = (p: any = proposal(), rows: any[] = []) =>
  compileSemanticProposal(p, profile, semanticCatalog(rows, profile));

describe('transient semantic proposal compiler', () => {
  it('compiles shared SUM and ratio-of-sums through the canonical compiler', () => {
    const p: any = proposal();
    p.measures.push({
      key: 'average',
      definition: {
        ...definition,
        label: '평균 입찰가',
        aggregation: 'RATIO_SUM',
        column: 'bid_floor',
        denominatorColumn: 'has_bid_floor_cnt',
        scale: 1,
        decimalPlaces: 2,
      },
    });
    p.blocks.push({ key: 'average', measureKey: 'average', chart: 'number', title: '평균 입찰가' });
    const c = compile(p);
    expect(c.draft.widgets[0].sql).toBe('SELECT SUM("bid_request_cnt") AS value FROM source');
    expect(c.draft.widgets[1].sql).toContain('GROUP BY "device_os" ORDER BY value DESC LIMIT 500');
    expect(c.draft.widgets[2].sql).toContain('NULLIF(SUM(CAST("has_bid_floor_cnt" AS DOUBLE)), 0)');
    expect(c.plan.measures).toHaveLength(2);
  });
  it('reuses by calculation and unit, not name, and searches beyond model catalog limit', () => {
    const rows = Array.from({ length: 35 }, (_, i) =>
      row(i + 1, {
        definition: JSON.stringify({
          schemaVersion: 1,
          definitionVersion: 1,
          sourceId: 7,
          tableName: 'uploaded_data',
          ...definition,
          column: 'bid_floor',
        }),
      }),
    );
    rows.push(row(40), row(39));
    const c = compile(proposal(), rows);
    expect(c.plan.measures[0]).toMatchObject({
      action: 'reuse',
      metricId: 39,
      definitionVersion: 2,
    });
    expect(metricIdentity({ ...definition, label: '다른 이름', decimalPlaces: 3 }, 7)).toBe(
      metricIdentity(definition, 7),
    );
    expect(metricIdentity({ ...definition, unit: '%' }, 7)).not.toBe(metricIdentity(definition, 7));
  });
  it('ignores inactive, foreign, malformed and unsupported saved definitions', () => {
    expect(
      semanticCatalog(
        [
          row(1, { useYn: 'N' }),
          row(2, { databaseId: 8 }),
          row(3, { definition: '{' }),
          row(4, { definition: JSON.stringify({ ...definition, sql: 'SELECT 1' }) }),
        ],
        profile,
      ),
    ).toEqual([]);
  });
  it('checks explicit reference versions and missing references', () => {
    const p: any = proposal();
    p.measures = [{ key: 'requests', reuse: { metricId: 11, definitionVersion: 1 } }];
    expect(() => compile(p, [row()])).toThrow(ConflictException);
    expect(() => compile(p)).toThrow(BadRequestException);
    p.measures[0].reuse.definitionVersion = 2;
    expect(compile(p, [row()]).plan.measures[0].metricId).toBe(11);
  });
  it('keeps display variants while collapsing identical aliases', () => {
    const p: any = proposal();
    p.measures.push({ key: 'alias', definition: { ...definition } });
    p.blocks[1].measureKey = 'alias';
    expect(compile(p).proposal.measures).toHaveLength(1);
    p.measures[1].definition.decimalPlaces = 2;
    expect(compile(p).proposal.measures).toHaveLength(2);
    expect(compile(p).draft.widgets[1].decimalPlaces).toBe(2);
  });
  it('produces stable dimensions and digests and rejects source drift', () => {
    expect(compile().previewDigest).toBe(compile().previewDigest);
    expect(compile().plan.dimensions[0]).toMatchObject({
      id: expect.stringMatching(/^dim_[a-f0-9]{64}$/),
      type: 'VARCHAR',
      definitionVersion: 1,
    });
    expect(() => compile({ ...proposal(), sourceRevision: 'old' })).toThrow(ConflictException);
  });
  it.each([
    (p: any) => {
      p.sql = 'DROP TABLE metric';
    },
    (p: any) => {
      p.measures[0].definition.sql = 'SELECT 1';
    },
    (p: any) => {
      p.measures[0].definition.column = 'device_os';
    },
    (p: any) => {
      p.measures[0].definition.aggregation = 'COUNT';
    },
    (p: any) => {
      p.measures[0].definition.decimalPlaces = 7;
    },
    (p: any) => {
      p.measures[0].definition.scale = 1;
    },
    (p: any) => {
      p.blocks[0].dimensionKey = 'os';
    },
    (p: any) => {
      p.blocks[1].chart = 'line';
    },
    (p: any) => {
      p.blocks[1].measureKey = '__proto__';
    },
    (p: any) => {
      p.dimensions.push({ key: 'unused', column: 'time' });
    },
    (p: any) => {
      p.blocks.push(p.blocks[0]);
    },
    (p: any) => {
      p.title = 'x'.repeat(130 * 1024);
    },
  ])('rejects unsupported shapes/types/references (%#)', mutate => {
    const p: any = proposal();
    mutate(p);
    expect(() => compile(p)).toThrow(BadRequestException);
  });
  it('rejects a new ratio over its own column but reads and reuses a saved one as stored', () => {
    const selfRatio = {
      ...definition,
      aggregation: 'RATIO_SUM',
      column: 'bid_request_cnt',
      denominatorColumn: 'bid_request_cnt',
      scale: 100,
      unit: '%',
    };
    const p: any = proposal();
    p.measures[0].definition = selfRatio;
    expect(() => compile(p)).toThrow('같은 열');
    // Saved definitions are never refused on read or reuse: an existing metric keeps its arithmetic.
    const saved = row(11, {
      definition: JSON.stringify({
        schemaVersion: 1,
        definitionVersion: 2,
        sourceId: 7,
        tableName: 'uploaded_data',
        ...selfRatio,
      }),
    });
    expect(semanticCatalog([saved], profile)).toHaveLength(1);
    const reuse: any = proposal();
    reuse.measures = [{ key: 'requests', reuse: { metricId: 11, definitionVersion: 2 } }];
    expect(compile(reuse, [saved]).plan.measures[0]).toMatchObject({
      action: 'reuse',
      metricId: 11,
    });
  });
  it('supports COUNT star and temporal line explicitly', () => {
    const p: any = proposal();
    p.measures[0].definition = { ...definition, aggregation: 'COUNT', column: '*' };
    p.dimensions[0].column = 'time';
    p.blocks[1].chart = 'line';
    expect(compile(p).draft.widgets[1].sql).toBe(
      'SELECT "time" AS dimension, COUNT(*) AS value FROM source GROUP BY "time" ORDER BY dimension LIMIT 500',
    );
  });
});
