import { legacyBlockIds, storedBlockIds, blockGeometry } from './dashboard-blocks';
import { validateDraft } from './dashboard-draft';
const widget = {
  title: 'KPI',
  description: '',
  type: 'BOARD_NUMERIC',
  sql: 'SELECT SUM(amount) AS value FROM source',
  valueField: 'value',
};
const raw = () => ({
  databaseId: 1,
  title: 'Test',
  explanation: '',
  widgets: [{ ...widget }, { ...widget }],
});
it('UC-006 provides deterministic read IDs and validates uniqueness', () => {
  const before = raw();
  const draft = legacyBlockIds(before, 8);
  expect(before.widgets[0]).not.toHaveProperty('blockId');
  expect(legacyBlockIds(before, 8)).toEqual(draft);
  expect(() => validateDraft({ ...draft, widgets: [draft.widgets[0], draft.widgets[0]] })).toThrow(
    'identity',
  );
});
it('UC-006 issues new server identities and reuses stable ones with a legacy same-count adapter', () => {
  const old = storedBlockIds(raw());
  expect(new Set(old.widgets.map(w => w.blockId)).size).toBe(2);
  expect(storedBlockIds(old, old)).toEqual(old);
  expect(storedBlockIds(raw(), old)).toEqual(old);
  expect(() =>
    storedBlockIds({ ...old, widgets: [{ ...old.widgets[0], blockId: 'unknown' }] }, old),
  ).toThrow('알 수');
  expect(() => storedBlockIds({ ...raw(), widgets: [widget] }, old)).toThrow('다시');
});
it('UC-006 reorders by identity, preserves geometry and appends a new block below existing occupied rows', () => {
  const old = legacyBlockIds(raw(), 8);
  const next = storedBlockIds({ ...old, widgets: [old.widgets[1], widget] }, old);
  const geometry = blockGeometry(
    old,
    next,
    [
      { i: '20', x: 4, y: 9, w: 6, h: 3, minW: 2 },
      { i: '21', x: 0, y: 4, w: 6, h: 2 },
    ],
    [{ widgetId: 20 }, { widgetId: 21 }],
  );
  expect(geometry[0]).toEqual({ i: '21', x: 0, y: 4, w: 6, h: 2 });
  expect(geometry[1]).toEqual({ x: 0, y: 12, w: 6, h: 2 });
});
