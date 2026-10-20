import { importStudio, studioDefinitions } from './studio-legacy';

describe('Studio initial responsive import', () => {
  it('fills stacked tablet rows without changing desktop coordinates or the input', () => {
    const analysis = {
      databaseId: 3,
      title: '원화 매출',
      revision: 'a'.repeat(64),
      widgets: [
        {
          blockId: 'won1',
          type: 'BOARD_NUMERIC',
          title: '매출',
          description: '',
          suffix: ' KRW',
          decimalPlaces: 0,
        },
        {
          blockId: 'won2',
          type: 'BOARD_NUMERIC',
          title: '환불',
          description: '',
          suffix: ' KRW',
          decimalPlaces: 0,
        },
      ],
      blockLayouts: {
        won1: { x: 0, y: 0, w: 6, h: 3 },
        won2: { x: 6, y: 0, w: 6, h: 3 },
      },
    };
    const before = JSON.stringify(analysis);
    const doc = importStudio(2, analysis, null, 'columns-v1');
    expect(doc.layouts.md).toEqual([
      { id: 'won1', x: 0, y: 0, w: 8, h: 3 },
      { id: 'won2', x: 0, y: 3, w: 8, h: 3 },
    ]);
    expect(doc.layouts.xs).toEqual([
      { id: 'won1', x: 0, y: 0, w: 1, h: 3 },
      { id: 'won2', x: 0, y: 3, w: 1, h: 3 },
    ]);
    expect(doc.layouts.lg).toEqual([
      { id: 'won1', ...analysis.blockLayouts.won1 },
      { id: 'won2', ...analysis.blockLayouts.won2 },
    ]);
    expect(doc.blocks[0].display).toMatchObject({ suffix: ' KRW', decimalPlaces: 0 });
    expect(JSON.stringify(analysis)).toBe(before);
  });
});

describe('UC050 frozen metric basis projection', () => {
  const fixture = () => {
    const definition = {
      schemaVersion: 1,
      sourceId: 3,
      definitionVersion: 2,
      label: '매출',
      aggregation: 'RATIO_SUM',
      column: 'refund',
      denominatorColumn: 'revenue',
      scale: 100,
      unit: '%',
      sql: 'secret',
      connectionConfig: 'secret',
    };
    const analysis = {
      databaseId: 3,
      revision: 'r',
      explanation: '',
      widgets: [{ blockId: 'b1', sql: 'private' }],
    };
    const document = {
      dashboardId: 4,
      sourceId: 3,
      revision: 'r',
      blocks: [{ id: 'b1', definitionKey: 'b1', measureRefs: [{ id: 9, definitionVersion: '2' }] }],
    } as any;
    const snapshot = {
      schemaVersion: 2,
      kind: 'structured-bi-dashboard',
      sourceId: 3,
      items: [{ key: 'b1', metricId: 9, definitionVersion: 2, definition }],
    };
    return { document, analysis, snapshot };
  };
  it('projects only the stored basis and leaves all inputs unchanged', () => {
    const f = fixture();
    const before = JSON.stringify(f);
    const basis = studioDefinitions(f.document, f.analysis, f.snapshot).entries.b1.metricBasis;
    expect(basis).toEqual({
      sourceId: 3,
      metricId: 9,
      definitionVersion: '2',
      definition: {
        aggregation: 'RATIO_SUM',
        column: 'refund',
        denominatorColumn: 'revenue',
        scale: 100,
        unit: '%',
      },
    });
    expect(JSON.stringify(basis)).not.toMatch(/secret|private|sql|connectionConfig/);
    expect(JSON.stringify(f)).toBe(before);
  });
  it.each(['source', 'key', 'emptyKey', 'version', 'reference', 'missing'])(
    'omits an unproven basis: %s',
    kind => {
      const f = fixture();
      if (kind === 'source') f.snapshot.sourceId = 8;
      if (kind === 'key') f.snapshot.items[0].key = 'b2';
      if (kind === 'emptyKey') f.snapshot.items[0].key = '';
      if (kind === 'version') f.snapshot.items[0].definitionVersion = 3;
      if (kind === 'reference') f.document.blocks[0].measureRefs = [];
      if (kind === 'missing') f.snapshot.items = [];
      expect(
        studioDefinitions(f.document, f.analysis, f.snapshot).entries.b1.metricBasis,
      ).toBeUndefined();
    },
  );
  it('keeps old unlinked definitions compatible', () => {
    const f = fixture();
    expect(studioDefinitions(f.document, f.analysis).entries.b1.metricBasis).toBeUndefined();
  });
});
