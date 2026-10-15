import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Widget } from '../widget/entities/widget.entity';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { UserService } from 'src/user/user.service';
import { AuthService } from 'src/auth/auth.service';
import { User } from '../user/entities/user.entity.js';
import { YesNo } from 'src/common/enum/yn.enum';
import { DashboardShare } from 'src/dashboard/entities/dashboard_share.entity';
import { UserMapping } from 'src/user/entities/user-mapping.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Dashboard)
    private dashboardRepository: Repository<Dashboard>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(DashboardShare)
    private readonly dashboardShareRepository: Repository<DashboardShare>,
    @InjectRepository(UserMapping)
    private userMappingRepository: Repository<UserMapping>,
    private readonly dashboardWidgetService: DashboardWidgetService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    @InjectRepository(Widget) private readonly widgetRepository: Repository<Widget>,
  ) {}

  async assertOwner(dashboardId: number, userId: number): Promise<void> {
    if (!Number.isInteger(dashboardId) || dashboardId <= 0) {
      throw new BadRequestException('invalid dashboard id');
    }
    const dashboard = await this.dashboardRepository.findOne({ where: { id: dashboardId } });
    if (!dashboard || dashboard.delYn === YesNo.YES) {
      throw new NotFoundException('dashboard not found');
    }
    if (!Number.isInteger(userId) || userId <= 0)
      throw new ForbiddenException('not dashboard owner');
    const mapping = await this.userMappingRepository.findOne({
      where: { dashboardId, userInfoId: userId },
    });
    if (!mapping) throw new ForbiddenException('not dashboard owner');
  }

  private async validateLayout(layout: unknown): Promise<number[]> {
    if (!Array.isArray(layout)) throw new BadRequestException('layout must be an array');
    const ids: number[] = [];
    for (const item of layout) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException('invalid layout item');
      }
      const id = typeof item.i === 'number' || typeof item.i === 'string' ? Number(item.i) : NaN;
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !Number.isFinite(item.x) ||
        item.x < 0 ||
        !Number.isFinite(item.y) ||
        item.y < 0 ||
        !Number.isFinite(item.w) ||
        item.w <= 0 ||
        !Number.isFinite(item.h) ||
        item.h <= 0 ||
        ids.includes(id)
      ) {
        throw new BadRequestException('invalid layout item');
      }
      ids.push(id);
    }
    if (ids.length) {
      const widgets = await this.widgetRepository.find({ where: { id: In(ids) } });
      const existing = new Set(widgets.map(widget => widget.id));
      if (ids.some(id => !existing.has(id))) throw new BadRequestException('widget not found');
    }
    return ids;
  }

  async create(createDashboardDto: CreateDashboardDto, accessToken: number) {
    const userData = await this.userRepository.findOne({
      where: { id: accessToken },
    });
    if (!userData) {
      return 'Bad Request';
    }
    const widgetIds = await this.validateLayout(createDashboardDto.layout);
    const share_id = await this.dashboardShareRepository.save({
      uuid: uuidv4(), // uuid의 버전 uuidv1의 결우 mac의 정보등을 담고있음.
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('test', share_id);
    const saveObj = {
      title: createDashboardDto.title,
      layout: JSON.stringify(createDashboardDto.layout),
      delYn: YesNo.NO,
      shareId: share_id.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const newDashboard = await this.dashboardRepository.save(saveObj);

    await this.userMappingRepository.save({
      dashboardId: newDashboard.id,
      userInfoId: accessToken,
      createdAt: new Date(),
    });

    // const newDashboard = await this.dashboardRepository.save(saveObj);

    // user테이블에 대시보드id저장
    const { id } = userData;
    // const test = await this.dashboardRepository
    //   .createQueryBuilder()
    //   .insert()
    //   .into(Dashboard, ['title', 'layout'])
    //   .values(saveObj)
    //   .orUpdate(['title', 'layout'], ['id'])
    //   .execute();
    // console.log('test', test.generatedMaps[0].id);
    // 기존 코드

    // await this.userService.saveDashboard(newDashboard.id, id);

    const saveObjDW = {
      dashboardId: newDashboard.id,
      widgetIds: widgetIds,
    };
    newDashboard.layout = JSON.parse(newDashboard.layout);
    await this.dashboardWidgetService.create(saveObjDW);
    return { status: ResponseStatus.SUCCESS, data: newDashboard };
  }

  async findAll(userId: number) {
    const findUser = await this.userService.findDashboardId(userId);
    if (!findUser) {
      return 'not exist user';
    }
    console.log(findUser);
    const findId = findUser.map(el => el['dashboardId']);
    if (findId === null) {
      throw new HttpException('not found', HttpStatus.NOT_FOUND);
    }
    console.log(findId);
    const find_all = [];
    for (let i = 0; findId.length > i; i++) {
      const dashboard = await this.dashboardRepository.findOne({
        where: { id: findId[i] },
        order: {
          updatedAt: 'desc',
          title: 'asc',
        },
      });
      if (dashboard && dashboard.delYn !== YesNo.YES) find_all.push(dashboard);
    }
    find_all.forEach(el => {
      console.log('adf,', el);
      el.layout = JSON.parse(el.layout);
    });
    return { status: ResponseStatus.SUCCESS, data: find_all };
  }
  // 기존 dashboard all

  async findOne(id: number, userId: number) {
    await this.assertOwner(id, userId);
    return this.assembleDashboard(id);
  }

  async findShared(id: number) {
    const result = await this.assembleDashboard(id);
    if (result.status !== ResponseStatus.SUCCESS) return result;
    // The existing live renderer needs only its narrowly scoped share token, never saved SQL/metric links.
    const data = result.data;
    return {
      status: result.status,
      data: Object.fromEntries(
        [
          'id',
          'uuid',
          'title',
          'layout',
          'widgets',
          'updatedAt',
          'createdAt',
          'shareYn',
          'endDate',
          'shareToken',
          'allowReuse',
        ]
          .filter(key => data[key] !== undefined)
          .map(key => [key, data[key]]),
      ),
    };
  }

  private async assembleDashboard(id: number) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id: id } });
    if (!find_dashboard) {
      return { status: ResponseStatus.ERROR, message: '대시보드가 존재하지 않습니다.' };
    }

    const widgetList = await this.dashboardWidgetService.findWidgets(find_dashboard.id);
    console.log('widgetList', widgetList);
    find_dashboard.layout = JSON.parse(find_dashboard.layout);
    const find_share_id = await this.dashboardShareRepository.findOne({
      where: { id: find_dashboard.shareId },
    });
    const return_obj = Object.assign({}, find_share_id, find_dashboard, { widgets: widgetList });
    return {
      status: ResponseStatus.SUCCESS,
      data: return_obj,
    };
  }

  async update(id: number, updateDashboardDto: UpdateDashboardDto) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id: id } });

    if (!find_dashboard) {
      return 'Not exist dashboard';
    } else {
      const hasLayout = updateDashboardDto.layout !== undefined;
      let widgetIds = hasLayout ? await this.validateLayout(updateDashboardDto.layout) : [];
      // UC-006: grid order is presentation, not analysis widget identity/order.
      if (hasLayout && find_dashboard.analysisDefinition) {
        const original = await this.dashboardRepository.manager.find(DashboardWidget, {
          where: { dashboardId: id },
          order: { id: 'ASC' },
        });
        if (
          original.length === widgetIds.length &&
          original.every(m => widgetIds.includes(m.widgetId))
        )
          widgetIds = original.map(m => m.widgetId);
      }

      if (updateDashboardDto.title) {
        find_dashboard.title = updateDashboardDto.title;
      }
      if (hasLayout) {
        find_dashboard.layout = JSON.stringify(updateDashboardDto.layout);
      }

      const saveObjDW = {
        dashboardId: id,
        widgetIds: widgetIds,
      };
      // 업데이트할 데이터
      if (hasLayout) await this.dashboardWidgetService.update(id, saveObjDW);
      const updatedDashboard = await this.dashboardRepository.save(find_dashboard);

      updatedDashboard.layout = JSON.parse(updatedDashboard.layout);
      return { status: ResponseStatus.SUCCESS, data: updatedDashboard };
    }
  }

  async remove(id: number) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id: id } });
    if (!find_dashboard) {
      return { status: ResponseStatus.ERROR, message: 'No exist dashboard' };
    } else {
      await this.dashboardRepository.delete(id);
      await this.dashboardWidgetService.remove(id);
      const find_dashboardId = await this.userMappingRepository.findOne({
        where: { dashboardId: id },
      });
      await this.userMappingRepository.delete(find_dashboardId.id);
      await this.dashboardShareRepository.delete(find_dashboard.shareId);
      return {
        status: ResponseStatus.SUCCESS,
        data: { message: `This action removes a #${id} dashboard` },
      };
    }
  }
}
