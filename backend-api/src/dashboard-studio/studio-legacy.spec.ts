import { importStudio } from './studio-legacy';

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
