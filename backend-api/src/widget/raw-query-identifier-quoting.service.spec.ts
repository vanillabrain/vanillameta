import { DataSource } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm/query-builder/SelectQueryBuilder';
import { ComponentService } from '../component/component.service';
import { Component } from '../component/entities/component.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DashboardWidgetService } from '../dashboard/dashboard-widget/dashboard-widget.service';
import { Template } from '../template/entities/template.entity';
import { TemplateItem } from '../template/entities/template-item.entity';
import { TemplateService } from '../template/template.service';
import { Widget } from './entities/widget.entity';
import { WidgetService } from './widget.service';

/**
 * The SQLite specs cannot catch this: SQLite is case-insensitive and accepts a bare alias. These
 * services build raw selects and joins with camelCase aliases (`componentType`, `widgetInfo`). On
 * PostgreSQL an unquoted alias is folded to lower case, so `widgetInfo.*` no longer matches the
 * quoted join alias and `componentType` comes back as `componenttype`; a MySQL backtick is a syntax
 * error there. Nothing connects: the SQL each service really builds is captured and inspected.
 */
const DRIVERS = [
  { type: 'postgres' as const, open: '"', close: '"' },
  { type: 'mysql' as const, open: '`', close: '`' },
];

describe.each(DRIVERS)('raw query identifiers on $type', ({ type, open, close }) => {
  let db: DataSource;
  let captured: string[];
  const quoted = (name: string) => `${open}${name}${close}`;

  beforeAll(async () => {
    db = new DataSource({
      type,
      database: 'unused',
      entities: [Widget, Component, DashboardWidget, Template, TemplateItem],
    } as never);
    await (db as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  });

  beforeEach(() => {
    captured = [];
    jest
      .spyOn(SelectQueryBuilder.prototype, 'getRawMany')
      .mockImplementation(async function (this: SelectQueryBuilder<unknown>) {
        captured.push(this.getQuery());
        return [];
      });
    jest
      .spyOn(SelectQueryBuilder.prototype, 'getRawOne')
      .mockImplementation(async function (this: SelectQueryBuilder<unknown>) {
        captured.push(this.getQuery());
        return undefined;
      });
  });
  afterEach(() => jest.restoreAllMocks());

  const sql = () => captured.join('\n');

  // A new unquoted camelCase alias or subquery alias slips past the `toContain` checks, so the
  // PostgreSQL case also forbids the shapes that were the bug.
  afterEach(() => {
    if (type !== 'postgres') return;
    expect(sql()).not.toMatch(/\b[aA][sS] [a-z]+[A-Z]\w*/);
    expect(sql()).not.toMatch(/(^|[\s,(])widgetInfo\./);
  });

  it('quotes the aliases ComponentService.findAll reads back, with no stray backtick on PostgreSQL', async () => {
    await new ComponentService(db.getRepository(Component)).findAll();

    expect(sql()).toContain(`as ${quoted('componentType')}`);
    expect(sql()).toContain(`as ${quoted('option')}`);
    if (type === 'postgres') expect(sql()).not.toContain('`');
  });

  it('quotes the component aliases the widget list reads back', async () => {
    const service = new WidgetService(
      db.getRepository(Widget),
      db.getRepository(Component),
      {} as never,
    );
    await service.findAll();

    for (const alias of ['componentType', 'icon', 'componentTitle', 'componentDescription']) {
      expect(sql()).toContain(`as ${quoted(alias)}`);
    }
  });

  it('quotes the subquery alias and its join column in WidgetService.findOne', async () => {
    const service = new WidgetService(
      db.getRepository(Widget),
      db.getRepository(Component),
      {} as never,
    );
    await service.findOne(1);

    expect(sql()).toContain(`${quoted('widgetInfo')}.*`);
    expect(sql()).toContain(`${quoted('widgetInfo')}.${quoted('componentId')}`);
    for (const alias of ['componentType', 'icon', 'componentTitle', 'componentDescription']) {
      expect(sql()).toContain(`as ${quoted(alias)}`);
    }
  });

  it('quotes the subquery alias and its join column in DashboardWidgetService.findWidgets', async () => {
    const dashboardWidgets = db.getRepository(DashboardWidget);
    jest.spyOn(dashboardWidgets, 'find').mockResolvedValue([{ widgetId: 4 } as DashboardWidget]);
    await new DashboardWidgetService(
      dashboardWidgets,
      db.getRepository(Widget),
      db.getRepository(Component),
    ).findWidgets(2);

    expect(sql()).toContain(`${quoted('widgetInfo')}.*`);
    expect(sql()).toContain(`${quoted('widgetInfo')}.${quoted('componentId')}`);
    expect(sql()).toContain(`as ${quoted('componentType')}`);
  });

  const templateService = () =>
    new TemplateService(
      db.getRepository(Template),
      db.getRepository(TemplateItem),
      db.getRepository(Widget),
      db.getRepository(Component),
    );

  it('quotes the aliases the template recommendation reads back and binds the id list as a list', async () => {
    // Not mocked: both queries it runs are captured, so the checks below cover them too.
    await templateService().findRecommendTemplates([1, 2]);

    expect(sql()).toContain(`as ${quoted('componentCategory')}`);
    expect(sql()).toContain(`as ${quoted('componentType')}`);
    expect(sql()).toContain(`widget.${quoted('componentId')}`);
    expect(sql()).toContain('id in (:...id)');
  });

  it('quotes the subquery alias and its join column when laying out a template dashboard', async () => {
    // Only the widget query matters here; the template lookups after it have no connection.
    await templateService()
      .getTemplateDashboardLayout([1], 1)
      .catch(() => undefined);

    expect(sql()).toContain(`${quoted('widgetInfo')}.*`);
    expect(sql()).toContain(`${quoted('widgetInfo')}.${quoted('componentId')}`);
    expect(sql()).toContain(`as ${quoted('category')}`);
  });

  it('quotes the count aliases and the useYn column of the template recommendation query', async () => {
    await (
      templateService() as unknown as { getRecommendTemplates(list: unknown[]): Promise<unknown> }
    ).getRecommendTemplates([]);

    for (const alias of ['horizontalCnt', 'verticalCnt', 'squareCnt', 'scoreCnt', 'totalCnt']) {
      expect(sql()).toContain(`as ${quoted(alias)}`);
    }
    expect(sql()).toContain(`${quoted('template')}.${quoted('useYn')} = 'Y'`);
    expect(sql()).not.toMatch(/WHERE useYn/);
  });
});
