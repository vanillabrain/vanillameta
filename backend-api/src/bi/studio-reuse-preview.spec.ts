jest.mock('../ai/ai.service', () => ({ AiService: class {} }));
import { DuckDBInstance } from '@duckdb/node-api';
import * as path from 'path';
import { captureStudioReuseOrigin, prepareStudioReusePlan } from './studio-reuse-plan';
import { previewStudioReuse } from './studio-reuse-preview';
import { studioReuseFixture } from './studio-reuse.fixture';
describe('read-only mixed reuse preview on actual target DuckDB', () => {
  it.each([1, 2])(
    'calculates renamed target with %i copies and no metadata writes',
    async count => {
      const f = studioReuseFixture(),
        db = await DuckDBInstance.create(':memory:'),
        c = await db.connect();
      try {
        const file = path
          .resolve(__dirname, '../../../samples/rill-scenarios/data/margin.csv')
          .replace(/'/g, "''");
        await c.run(
          `CREATE TABLE uploaded_data AS SELECT day AS event_day,company AS customer,component AS service,revenue AS sales,profit AS earnings FROM read_csv_auto('${file}')`,
        );
        if (count === 2) await c.run('INSERT INTO uploaded_data SELECT * FROM uploaded_data');
        const plan = prepareStudioReusePlan(captureStudioReuseOrigin(f), f.target, {
          title: 'Target copy',
          columnMap: f.columnMap,
          blockIds: ['chart-a', 'pivot-a'],
        });
        const checks = jest.fn(async () => undefined);
        const result = await previewStudioReuse(plan, {
          assertCurrent: checks,
          query: async (sql, bindings) =>
            (await c.runAndReadAll(sql, bindings as any)).getRowObjects(),
          previewCharts: async draft => ({
            widgets: draft.widgets.map(w => ({ ...w, fields: ['value'], datas: [{ value: 123 }] })),
          }),
        });
        const pivot: any = result.blocks[1];
        expect(Number(pivot.pivot.kpis[0].value)).toBeCloseTo(5431.25 * count, 8);
        expect(Number(pivot.pivot.kpis[1].value)).toBeCloseTo(5.390840046029919, 10);
        expect(result.blocks.map(b => b.blockId)).toEqual(['chart-a', 'pivot-a']);
        expect(result.newMetricCount).toBe(2);
        expect(checks.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(JSON.stringify(result)).not.toMatch(/"sql"|"definition"|"candidate:/);
      } finally {
        c.closeSync();
        db.closeSync();
      }
    },
  );
  it('common_scope_overrides_pivot_scope_per_column', async () => {
    const f = studioReuseFixture();
    f.document.filters = [{ column: 'company', values: ['Baro Tech'] }];
    f.snapshot.studioFilters = f.document.filters;
    f.document.blocks[1].pivot.state.filters = [{ column: 'company', values: ['Hanul Foods'] }];
    f.snapshot.studioPivots = [f.document.blocks[1]];
    const p = prepareStudioReusePlan(captureStudioReuseOrigin(f), f.target, {
      title: 'Scoped',
      columnMap: f.columnMap,
      blockIds: ['chart-a', 'pivot-a'],
    });
    expect(p.blocks[1].pivot.filters).toEqual([{ column: 'customer', values: ['Baro Tech'] }]);
  });
});
