import { DashboardService } from './dashboard.service';

/**
 * A row without a usable `dashboardId` used to become `findOne({ where: { id: undefined } })`, which
 * TypeORM treats as "no condition" and answers with the newest dashboard of anyone.
 */
describe('DashboardService.findAll ids', () => {
  const build = (mappingRows: unknown[]) => {
    const findOne = jest.fn(async ({ where }: any) => ({
      id: where.id,
      title: `d${where.id}`,
      layout: '[]',
      delYn: 'N',
      assetActive: true,
    }));
    const service = Object.create(DashboardService.prototype) as any;
    service.userService = { findDashboardId: jest.fn().mockResolvedValue(mappingRows) };
    service.dashboardRepository = { findOne };
    return { service: service as DashboardService, findOne };
  };

  it('looks up only the dashboards the user maps to', async () => {
    const { service, findOne } = build([{ dashboardId: 1 }, { dashboardId: 7 }]);
    const result: any = await service.findAll(1);
    expect(result.data.map((d: any) => d.id)).toEqual([1, 7]);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('never queries with an undefined id when a mapping row has no dashboardId', async () => {
    const { service, findOne } = build([{ user_mapping_dashboardId: 7 }, { dashboardId: 3 }]);
    const result: any = await service.findAll(1);
    expect(result.data.map((d: any) => d.id)).toEqual([3]);
    expect(findOne.mock.calls.every(([arg]: any[]) => Number.isInteger(arg.where.id))).toBe(true);
  });
});
