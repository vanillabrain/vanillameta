import { DataSource } from 'typeorm';
import { Component } from '../component/entities/component.entity';
import { Widget } from './entities/widget.entity';
import { WidgetService } from './widget.service';

describe('WidgetService.findOne reads a widget joined with its chart component', () => {
  let db: DataSource;
  let service: WidgetService;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [Widget, Component],
    }).initialize();
    service = new WidgetService(db.getRepository(Widget), db.getRepository(Component), {} as never);
  });
  afterAll(() => db.destroy());

  it('returns the widget with its component columns instead of failing on an ambiguous id', async () => {
    const components = db.getRepository(Component);
    const component = await components.save(
      components.create({
        type: 'bar',
        title: 'Bar',
        description: 'bar chart',
        category: 'chart',
        icon: 'bar',
        option: '{}',
      }),
    );
    const widgets = db.getRepository(Widget);
    const widget = await widgets.save(
      widgets.create({
        title: 'sales',
        componentId: component.id,
        datasetId: 1,
        option: JSON.stringify({ a: 1 }),
      }),
    );

    const found: any = await service.findOne(widget.id);
    expect(found.status).toBe('SUCCESS');
    expect(found.data).toMatchObject({ title: 'sales', componentType: 'bar', option: { a: 1 } });
    expect(await service.findOne(99999)).toMatchObject({ status: 'ERROR' });
  });
});
