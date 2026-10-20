import { expect } from '@playwright/test';
import { Actor, RECORDS, call, dataset, ok, unique, upload } from './helpers';

export const WIDE_RECORDS = RECORDS.map(row => ({
  ...row,
  value: row.amount, x: row.id, y: row.id, z: row.id, size: row.id,
  cat1: row.region, cat2: row.category, date: `2025-01-0${row.id}`,
  education: row.amount, wage: row.amount, experience: row.amount, age: row.amount,
  occupation: row.amount, annualSalary: row.amount, yearsmarried: row.amount,
  gender: row.id === 2 ? 'M' : 'F', marital: row.id === 2 ? 'single' : 'married',
  violent: row.amount, robbery: row.amount, murder: row.amount, prisoners: row.amount,
  year: row.amount, price: row.amount, years: row.amount, nox: row.amount,
  rm: row.amount, dis: row.amount, crim: row.amount, mage: row.amount,
  sale_date: `2025-01-0${row.id}`, total_amount: row.amount,
  market: row.region, product: row.category,
}));

export type StockComponent = { id: number; componentType: string; title: string; option: any };
export type StockWidget = { id: number; componentId: number; componentType: string; option: any };
export type ChartInventory = { components: StockComponent[]; seedWidgets: StockWidget[] };

function plainOption(option: any) {
  return typeof option === 'string' ? JSON.parse(option) : JSON.parse(JSON.stringify(option));
}

export function runCreatedComponent(item: StockComponent, ids: number[]) {
  return ids.includes(Number(item.id)) && /^QA_TYPE_[0-9a-f]{10}$/.test(item.componentType);
}

export function stockInventory(components: StockComponent[], widgets: StockWidget[], runCreatedIds: number[] = []): ChartInventory {
  expect(Array.isArray(components)).toBe(true);
  expect(Array.isArray(widgets)).toBe(true);
  const stock = components.filter(item => !runCreatedComponent(item, runCreatedIds));
  expect(stock.length).toBeGreaterThan(0);
  expect(new Set(stock.map(item => item.componentType)).size, 'stock types must be unique').toBe(stock.length);
  return {
    components: stock.map(item => ({ ...item, option: plainOption(item.option) })),
    seedWidgets: widgets.filter(item => Number(item.id) <= 100).map(item => ({ ...item, option: plainOption(item.option) })),
  };
}

function referencedFields(option: any) {
  const references: string[] = [];
  const walk = (value: any, position: string) => {
    if (Array.isArray(value)) { value.forEach((child, index) => walk(child, `${position}[${index}]`)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const isField = /^(?:field|xField|yField|zField|categoryField|sizeField)$/.test(key) || (key === 'name' && /(?:series|pie|columns)/.test(position));
      if (isField && typeof child === 'string') {
        if (child) references.push(child);
      } else if (isField && Array.isArray(child)) {
        references.push(...child.filter(item => typeof item === 'string'));
      } else walk(child, `${position}.${key}`);
    }
  };
  walk(option, 'option');
  return [...new Set(references)];
}

export function optionFor(component: StockComponent, inventory: ChartInventory) {
  if (component.componentType === 'CHART_WATERFALL_BAR' || component.componentType === 'CHART_WATERFALL_COLUMN') {
    const option = plainOption(component.option);
    expect(Array.isArray(option.series)).toBe(true);
    expect(option.series.length).toBeGreaterThan(0);
    if (component.componentType === 'CHART_WATERFALL_BAR') option.xField = 'name';
    else option.yField = 'name';
    option.series = option.series.map((item: any) => ({ ...item, field: 'amount', aggregation: 'sum' }));
    const fields = ['name', 'amount'];
    expect(referencedFields(option).sort()).toEqual([...fields].sort());
    expect(fields.every(field => Object.hasOwn(WIDE_RECORDS[0], field))).toBe(true);
    return { option, seedWidgetId: null, fixtureSource: 'explicit-leading-approved-waterfall-option', fields };
  }
  const candidates = inventory.seedWidgets.filter(widget => widget.componentType === component.componentType && Number(widget.componentId) === Number(component.id));
  expect(candidates.length, `${component.componentType}: no matching seed widget option; lead decision required`).toBeGreaterThan(0);
  const valid = candidates.find(widget => {
    const fields = referencedFields(widget.option);
    return fields.length > 0 && fields.every(field => Object.hasOwn(WIDE_RECORDS[0], field));
  });
  expect(valid, `${component.componentType}: seed option missing fields in approved wide fixture: ${JSON.stringify(candidates.map(widget => ({ seedId: widget.id, fields: referencedFields(widget.option) })))}`).toBeTruthy();
  const option = plainOption(valid!.option);
  const normalizeNumeric = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (value.header && value.content && Object.hasOwn(value.content, 'field')) {
      value.content.field = 'amount';
      value.content.aggregation = 'sum';
      value.content.prefix = '';
      value.content.suffix = '';
    }
    for (const child of Object.values(value)) normalizeNumeric(child);
  };
  normalizeNumeric(option);
  if (component.componentType === 'BOARD_NUMERIC') {
    expect(option.content.field).toBe('amount');
    expect(option.content.aggregation).toBe('sum');
  }
  return { option, seedWidgetId: valid!.id, fixtureSource: 'matching-seed-widget-option', fields: referencedFields(option) };
}

export async function chartDataset(owner: Actor, query: string) {
  const columns = Object.keys(WIDE_RECORDS[0]);
  const escape = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [columns.join(','), ...WIDE_RECORDS.map(row => columns.map(column => escape(row[column as keyof typeof row])).join(','))].join('\n') + '\n';
  const source = await upload(owner, csv);
  expect(typeof query, 'lead-authored wideRowsSql must be supplied in the frozen inventory').toBe('string');
  expect(query.length).toBeGreaterThan(0);
  const set = await dataset(owner, source.id, query);
  return { source, set, query };
}

export async function cloneWidget(owner: Actor, component: StockComponent, setId: number, inventory: ChartInventory) {
  const fixture = optionFor(component, inventory);
  const title = `${unique()}_${component.componentType}`;
  const saved = await ok(await call(owner, 'POST', '/widget', {
    title, componentId: component.id, datasetType: 'DATASET', datasetId: setId, option: fixture.option,
  }));
  expect(Number(saved.id)).toBeGreaterThan(100);
  return { saved, ...fixture, title };
}
