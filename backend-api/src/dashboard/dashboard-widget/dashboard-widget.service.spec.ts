import { DashboardWidgetService } from './dashboard-widget.service';

describe('DashboardWidgetService empty dashboard', () => {
  it('returns no widgets without constructing an invalid empty IN query', async () => {
    const mapping = { find: jest.fn().mockResolvedValue([]) };
    const widgets = { createQueryBuilder: jest.fn() };
    const components = { createQueryBuilder: jest.fn() };
    const service = new DashboardWidgetService(mapping as any, widgets as any, components as any);
    await expect(service.findWidgets(42)).resolves.toEqual([]);
    expect(mapping.find).toHaveBeenCalledWith({
      select: { widgetId: true },
      where: { dashboardId: 42 },
    });
    expect(widgets.createQueryBuilder).not.toHaveBeenCalled();
    expect(components.createQueryBuilder).not.toHaveBeenCalled();
  });
});
