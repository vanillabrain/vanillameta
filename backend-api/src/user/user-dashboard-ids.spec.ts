import { DataSource } from 'typeorm';
import { UserMapping } from './entities/user-mapping.entity';
import { UserService } from './user.service';

/**
 * `DashboardService.findAll` reads `row.dashboardId` from this result. Without an explicit alias the
 * raw key is `user_mapping_dashboardId`, every id is undefined, and `findOne({ where: { id:
 * undefined } })` returns the most recently updated dashboard of *anyone*. The list then looks right
 * while a user is the only one with dashboards and goes empty as soon as someone else saves one.
 */
describe('UserService.findDashboardId', () => {
  let db: DataSource;
  let service: UserService;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [UserMapping],
    }).initialize();
    service = new UserService({} as never, db.getRepository(UserMapping), {} as never);
  });
  afterAll(() => db.destroy());

  it("returns each of the user's dashboard ids under the key the callers read, and no one else's", async () => {
    const mappings = db.getRepository(UserMapping);
    await mappings.save([
      { userInfoId: 1, dashboardId: 1 },
      { userInfoId: 2, dashboardId: 2 },
      { userInfoId: 1, dashboardId: 7 },
    ] as UserMapping[]);

    const rows = await service.findDashboardId(1);

    expect(rows.map(row => row['dashboardId']).sort()).toEqual([1, 7]);
    expect(rows.every(row => Object.keys(row).join() === 'dashboardId')).toBe(true);
    expect(await service.findDashboardId(3)).toEqual([]);
  });
});
