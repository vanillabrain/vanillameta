jest.mock('./ai.service', () => ({ AiService: class {} }));
import { DuckDBInstance } from '@duckdb/node-api';
import { AiDashboardService } from './ai-dashboard.service';
import { sourceQuery, validateDraft } from './dashboard-draft';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Component } from '../component/entities/component.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';

const select = 'SELECT SUM("amount") AS value FROM source';
const wrapper = 'WITH source AS (SELECT * FROM uploaded_data) ';
function fixture(query = wrapper + select, saved: Record<string, unknown> = {}) {
  const dashboard = {
    id: 5,
    title: 'Reused widget',
    analysisDefinition: null,
    structuredDefinition: null,
    pivotDefinitions: null,
    ...saved,
  };
  const dataset = { id: 2, databaseId: 2, query };
  const service: any = Object.create(AiDashboardService.prototype);
  service.owner = jest.fn().mockResolvedValue(dashboard);
  service.dashboards = {
    manager: {
      find: jest.fn().mockResolvedValue([{ id: 1, dashboardId: 5, widgetId: 2 }]),
      findOne: jest.fn(async (entity: unknown) =>
        entity === Widget
          ? {
              id: 2,
              datasetId: 2,
              datasetType: DatasetType.DATASET,
              componentId: 1,
              title: 'Revenue',
              option: JSON.stringify({ content: { field: 'value', decimalPlaces: 2 } }),
            }
          : entity === Dataset
          ? dataset
          : entity === Component
          ? { type: 'BOARD_NUMERIC' }
          : null,
      ),
    },
  };
  service.preview = jest.fn(async (body: any) => ({ data: { draft: validateDraft(body.draft) } }));
  return { service, dataset };
}

it('reconstructs the exact unscoped server wrapper without rewriting stored SQL', async () => {
  const { service, dataset } = fixture();
  const result = await service.analysis(5, 2);
  expect(result.data.widgets[0].sql).toBe(select);
  expect(dataset.query).toBe(wrapper + select);
  expect(service.owner).toHaveBeenCalledWith(5, 2, 'read');
  const db = await DuckDBInstance.create(':memory:');
  const connection = await db.connect();
  try {
    await connection.run('CREATE TABLE uploaded_data(amount INTEGER)');
    await connection.run('INSERT INTO uploaded_data VALUES (100), (200), (50)');
    const rows = (
      await connection.runAndReadAll(sourceQuery(result.data.widgets[0].sql, ['amount']).sql)
    ).getRowObjectsJson();
    expect(Number(rows[0].value)).toBe(350);
  } finally {
    connection.closeSync();
    db.closeSync();
  }
});
it.each([
  'SELECT SUM("amount") AS value FROM uploaded_data',
  'SELECT SUM("amount") AS value FROM "uploaded_data"',
  select,
])('preserves existing plain SELECT support: %s', async query => {
  const { service } = fixture(query);
  expect((await service.analysis(5, 2)).data.widgets[0].sql).toBe(select);
});
it.each([
  'WITH source AS (SELECT * FROM uploaded_data WHERE amount > 100) ' + select,
  'WITH source AS (SELECT amount FROM uploaded_data) ' + select,
  'WITH source AS (SELECT * FROM other) ' + select,
  wrapper + ', other AS (SELECT * FROM source) ' + select,
  wrapper + 'WITH another AS (SELECT * FROM source) ' + select,
  wrapper + 'SELECT * FROM source; DELETE FROM uploaded_data',
  '/* preface */ ' + wrapper + select,
])('does not discard a scoped, foreign or unsafe wrapper: %s', async query => {
  const { service } = fixture(query);
  await expect(service.analysis(5, 2)).rejects.toThrow();
  expect(service.preview).not.toHaveBeenCalled();
});
it.each([
  { structuredDefinition: '{"studioFilters":[]}' },
  { structuredDefinition: '{}' },
  { structuredDefinition: '{broken' },
  { pivotDefinitions: '[]' },
  { analysisDefinition: '{}' },
  { analysisDefinition: '{broken' },
])('cannot bypass saved definitions: %j', async saved => {
  const { service } = fixture(undefined, saved);
  await expect(service.analysis(5, 2)).rejects.toThrow();
  expect(service.preview).not.toHaveBeenCalled();
});
it('retains the authorization boundary before reading or calculating', async () => {
  const { service } = fixture();
  service.owner.mockRejectedValue(new Error('access revoked'));
  await expect(service.analysis(5, 2)).rejects.toThrow('access revoked');
  expect(service.dashboards.manager.find).not.toHaveBeenCalled();
  expect(service.preview).not.toHaveBeenCalled();
});
