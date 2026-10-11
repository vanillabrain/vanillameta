import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { WIDGET_TYPE } from '../src/constant';
import { Actor, GOLD, ROOT, authorize, call, ok } from './helpers';
import { ChartInventory, WIDE_RECORDS, chartDataset, cloneWidget, runCreatedComponent, stockInventory } from './chart-fixtures';
import { evidence, gridCell, healthyPage, language, numericView, persisted, test, uiActor } from './ui-helpers';

const snapshotPath = process.env.QA_CHART_INVENTORY || path.join(ROOT, 'fixtures', 'stock-chart-inventory.json');
const snapshot = fs.existsSync(snapshotPath) ? JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) : null;
const variants: string[] = snapshot ? snapshot.components.filter((item: any) => !runCreatedComponent(item, snapshot.runCreatedComponentIds || [])).map((item: any) => item.componentType) : Object.values(WIDGET_TYPE);
expect(variants.length, 'Frozen stock inventory must never silently collect zero WIDGET-06 variants').toBeGreaterThan(0);
const known = new Set<string>(Object.values(WIDGET_TYPE));
let inventory: ChartInventory;
let owner: Actor;
let fixture: Awaited<ReturnType<typeof chartDataset>>;
test.beforeAll(async () => {
  expect(snapshot, `Lead must publish the frozen stock component/seed option inventory and wideRowsSql at ${snapshotPath} before running WIDGET-06`).toBeTruthy();
  inventory = stockInventory(snapshot.components, snapshot.seedWidgets, snapshot.runCreatedComponentIds || []);
  for (const component of inventory.components) expect(known.has(component.componentType), `enabled stock type ${component.componentType} must have a registered viewer`).toBe(true);
  owner = await uiActor();
  fixture = await chartDataset(owner, snapshot.wideRowsSql);
  const rows = await ok(await call(owner, 'GET', '/database/data', undefined, { params: { datasetType: 'DATASET', datasetId: fixture.set.id } }));
  expect(rows.datas).toEqual(WIDE_RECORDS);
});
test.afterAll(async () => { if (owner) await owner.context.dispose(); });

for (const componentType of variants) {
  test(`WIDGET-06 enabled stock component ${componentType}`, async ({ page }, info) => {
    const component = inventory.components.find(item => item.componentType === componentType)!;
    expect(component, `${componentType} must exist in the frozen enabled inventory`).toBeTruthy();
    const clone = await cloneWidget(owner, component, fixture.set.id, inventory);
    await language(page);
    await authorize(page, owner);
    const pending = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname.endsWith('/database/data') && url.searchParams.get('datasetId') === String(fixture.set.id);
    });
    await page.goto(`/widget/${clone.saved.id}`);
    const response = await pending;
    expect(response.status()).toBe(200);
    const actualData = await response.json();
    expect(actualData.status).toBe('SUCCESS');
    expect(actualData.data.datas).toEqual(WIDE_RECORDS);
    const saved = await persisted(owner, 'widget', clone.saved.id);
    expect(saved.componentType).toBe(component.componentType);
    expect(Number(saved.datasetId)).toBe(fixture.set.id);
    expect(saved.option).toEqual(clone.option);
    await expect(page.getByText(clone.title, { exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/componentNotSelected|failedWidget|Failed to load the widget|Please select a component|컴포넌트를 선택/);
    if (component.componentType === 'BOARD_NUMERIC') {
      await numericView(page, clone.title);
    } else if (component.componentType === 'BOARD_TABLE') {
      await expect(page.locator('.tui-grid-container')).toBeVisible();
      const columns = clone.option.columns.map((column: any) => column.name);
      expect(columns.length).toBeGreaterThan(0);
      for (const column of columns) {
        expect(Object.prototype.hasOwnProperty.call(WIDE_RECORDS[0], column)).toBe(true);
        for (const [index, row] of WIDE_RECORDS.entries()) await gridCell(page, column, String(row[column as keyof typeof row]), index);
      }
    } else {
      await expect(page.locator('.echarts-for-react').first()).toBeVisible();
      await expect(page.locator('.echarts-for-react canvas').first()).toBeVisible();
      if (component.componentType.includes('_3D_')) {
        const available = await page.evaluate(() => {
          const canvas = document.createElement('canvas');
          return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
        });
        expect(available, `${component.componentType}: unavailable WebGL is a blocker, never a skip`).toBe(true);
      }
      await expect.poll(async () => {
        const options = await page.locator('.echarts-for-react').evaluateAll(elements => elements.map((element: any) => {
        const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
        let fiber = key ? element[key] : null;
        while (fiber) {
          if (typeof fiber.stateNode?.getEchartsInstance === 'function') {
            const instance = fiber.stateNode.getEchartsInstance();
            const option = instance.getOption();
            const finite = (value: any): boolean => {
              if (typeof value === 'number') return Number.isFinite(value);
              if (Array.isArray(value)) return value.length > 0 && value.every(finite);
              if (value && typeof value === 'object') return finite(value.value ?? value.children);
              return typeof value === 'string' && value.length > 0;
            };
            const numeric = (value: any): boolean => {
              if (typeof value === 'number') return Number.isFinite(value);
              if (Array.isArray(value)) return value.some(numeric);
              if (value && typeof value === 'object') return numeric(value.value ?? value.children);
              return false;
            };
            return (option.series || []).map((series: any) => ({
              type: series.type, count: Array.isArray(series.data) ? series.data.length : 0,
              numeric: Array.isArray(series.data) && series.data.every(finite) && series.data.some(numeric),
              rendered: instance.getZr().storage.getDisplayList().length,
            }));
          }
          fiber = fiber.return;
        }
        return [];
        }));
        return options.length > 0 && options.every(series => series.length > 0 && series.every((item: any) => item.count > 0 && item.numeric && item.rendered > 0));
      }).toBe(true);
      const canvasSizes = await page.locator('.echarts-for-react canvas').evaluateAll(canvases => canvases.map(canvas => ({ width: (canvas as HTMLCanvasElement).width, height: (canvas as HTMLCanvasElement).height })));
      expect(canvasSizes.length).toBeGreaterThan(0);
      for (const size of canvasSizes) { expect(size.width).toBeGreaterThan(0); expect(size.height).toBeGreaterThan(0); }
      if (component.componentType.includes('BOARD_NUMERIC')) await expect(page.locator('.MuiCard-root').getByText(String(GOLD.sumAmount), { exact: true })).toBeVisible();
    }
    await healthyPage(page);
    await evidence(page, info, `WIDGET-06-${component.componentType}`, {
      componentType: component.componentType, componentId: component.id, widgetId: clone.saved.id,
      seedWidgetId: clone.seedWidgetId, fixtureSource: clone.fixtureSource, fields: clone.fields,
      datasetId: fixture.set.id, option: clone.option, response: actualData.data,
    });
  });
}
