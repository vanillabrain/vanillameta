import { Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { UserService } from 'src/user/user.service';
import { AuthService } from 'src/auth/auth.service';
import { User } from '../user/entities/user.entity.js';
import { YesNo } from 'src/common/enum/yn.enum';
import { DashboardShare } from './entities/dashboard_share';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Dashboard)
    private dashboardRepository: Repository<Dashboard>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(DashboardShare)
    private  readonly dashboardShareRepository: Repository<DashboardShare>,
    private readonly dashboardWidgetService: DashboardWidgetService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  async create(createDashboardDto: CreateDashboardDto, accessToken: string) {
    const findUser = await this.authService.verifyAccessToken(accessToken);
    const { accessKeyData } = findUser;
    const userData = await this.userRepository.findOne({
      where: { user_id: accessKeyData.user_id },
    });
    if (!userData) {
      return 'Bad Request';
    }
    const widgetIds = [];
    createDashboardDto.layout.map(item => {
      widgetIds.push(item.i);
    });
    const findTitle = await this.dashboardRepository.findOne({
      where: { title: createDashboardDto.title },
    });
    if (!findTitle) {
      const share_id = await this.dashboardShareRepository.save({
        createdAt: new Date(),
        updatedAt: new Date()
      });
      const saveObj = {
        title: createDashboardDto.title,
        layout: JSON.stringify(createDashboardDto.layout),
        del_yn: YesNo.NO,
        share_id: share_id.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const newDashboard = await this.dashboardRepository.save(saveObj);
      const saveObjDW = {
        dashboardId: newDashboard.id,
        widgetIds: widgetIds,
      };

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

      await this.userService.saveDashboard(newDashboard.id, id);
      await this.dashboardWidgetService.create(saveObjDW);

      newDashboard.layout = JSON.parse(newDashboard.layout);
      return { status: ResponseStatus.SUCCESS, data: newDashboard };
    }
    return 'already exist name title';
  }

  async findAll(accessToken: string) {

    const findUser = await this.userService.findDashboardId(accessToken);
    console.log(findUser)
    const findId = findUser.map(el =>
        el['dashboard_id']);
    const find_all = [];
    for (let i = 0; findId.length > i; i++) {
      find_all.push(
        await this.dashboardRepository.findOne({
          where: { id: findId[i] },
          order: {
            updatedAt: 'desc',
            title: 'asc',
          },
        }),
      );
    }
    console.log(findId)
    find_all.forEach(el => {
      el.layout = JSON.parse(el.layout);
    });
    return { status: ResponseStatus.SUCCESS, data: find_all };
  }
  // 기존 dashboard all

  async findOne(id: number) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id: id } });
    if (!find_dashboard)
      return { status: ResponseStatus.ERROR, message: '대시보드가 존재하지 않습니다.' };
    const widgetList = await this.dashboardWidgetService.findWidgets(id);

    find_dashboard.layout = JSON.parse(find_dashboard.layout);
    const find_share_id = await this.dashboardShareRepository.findOne({where : { id: find_dashboard.share_id}})
    console.log(find_share_id)
    const return_obj = Object.assign(find_dashboard, find_share_id, { widgets: widgetList });

    return { status: ResponseStatus.SUCCESS, data: return_obj };
  }

  async update(id: number, updateDashboardDto: UpdateDashboardDto) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id: id } });

    if (!find_dashboard) {
      return 'Not exist dashboard';
    } else {
      const widgetIds = [];

      if (updateDashboardDto.title) {
        find_dashboard.title = updateDashboardDto.title;
      }
      if (updateDashboardDto.layout) {
        updateDashboardDto.layout.map(item => {
          widgetIds.push(item.i);
        });
        find_dashboard.layout = JSON.stringify(updateDashboardDto.layout);
      }

      const saveObjDW = {
        dashboardId: id,
        widgetIds: widgetIds,
      };
      await this.dashboardWidgetService.update(id, saveObjDW);
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
      return {
        status: ResponseStatus.SUCCESS,
        data: { message: `This action removes a #${id} dashboard` },
      };
    }
  }
}
