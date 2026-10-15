import { validateStudioDocument } from './studio-document';
import { applyStudioOperation } from './studio-operations';
import { validateDraft } from '../ai/dashboard-draft';
const doc = () => ({
  schemaVersion: 1,
  sourceId: 1,
  title: 'Dashboard',
  blocks: [
    {
      id: 'b1',
      definitionKey: 'b1',
      kind: 'CHART_LINE',
      title: 'Daily',
      description: '',
      measureRefs: [],
      dimensionRefs: [],
      display: {},
    },
  ],
  layouts: {
    lg: [{ id: 'b1', x: 0, y: 0, w: 12, h: 5 }],
    md: [{ id: 'b1', x: 0, y: 0, w: 8, h: 5 }],
    xs: [{ id: 'b1', x: 0, y: 0, w: 1, h: 5 }],
  },
});
describe('Studio explicit time grain', () => {
  it('changes a selected temporal display without changing SQL references or layout', () => {
    const original = validateStudioDocument(doc());
    const next = applyStudioOperation(original, {
      type: 'updateBlock',
      blockId: 'b1',
      patch: { display: { timeGrain: 'week' } },
    });
    expect(next.blocks[0].display).toEqual({ timeGrain: 'week' });
    expect(next.layouts).toEqual(original.layouts);
    expect(next.blocks[0].measureRefs).toEqual(original.blocks[0].measureRefs);
  });
  it('preserves explicit widget grain through legacy save validation and rejects unsupported grain', () => {
    const input = {
      databaseId: 1,
      title: 'Test',
      explanation: '',
      widgets: [
        {
          type: 'CHART_LINE',
          title: 'Daily',
          description: '',
          sql: "SELECT date_trunc('day', event_time) AS day, sum(amount) AS value FROM source GROUP BY 1",
          categoryField: 'day',
          valueField: 'value',
          timeGrain: 'week',
        },
      ],
    };
    expect(validateDraft(input).widgets[0]).toMatchObject({ timeGrain: 'week' });
    expect(() =>
      validateDraft({ ...input, widgets: [{ ...input.widgets[0], timeGrain: 'year' }] }),
    ).toThrow();
  });
});
