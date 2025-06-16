import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { UserService } from 'src/user/user.service';
import { AuthService } from 'src/auth/auth.service';
import { User } from '../user/entities/user.entity';
import { YesNo } from 'src/common/enum/yn.enum';
import { DashboardShare } from 'src/dashboard/entities/dashboard_share.entity';
import { UserMapping } from 'src/user/entities/user-mapping.entity';
import { v4 as uuidv4 } from 'uuid';
import { CustomLoggerService } from '../common/logger/logger.service';

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
    private readonly logger: CustomLoggerService,
  ) {}

  async create(createDashboardDto: CreateDashboardDto, accessToken: number) {
    const userData = await this.userRepository.findOne({
      where: { id: accessToken },
    });
    if (!userData) {
      return 'Bad Request';
    }
    const widgetIds = [];
    createDashboardDto.layout.map(item => {
      widgetIds.push(item.i);
    });
    const share_id = await this.dashboardShareRepository.save({
      uuid: uuidv4(), // uuid의 버전 uuidv1의 결우 mac의 정보등을 담고있음.
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.logger.debug('Dashboard share created', 'DashboardService', {
      shareId: share_id.id,
      shareUuid: share_id.uuid,
      userId: accessToken.toString(),
    });
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
    if (!findUser || findUser.length === 0) {
      return 'not exist user';
    }
    console.log(findUser);
    const findId = findUser.map(el => el['dashboardId']);
    if (!findId || findId.length === 0) {
      throw new HttpException('not found', HttpStatus.NOT_FOUND);
    }
    console.log(findId);
    
    // 최적화된 쿼리: 필요한 커럼만 선택
    const find_all = await this.dashboardRepository
      .createQueryBuilder('dashboard')
      .leftJoinAndSelect('dashboard.dashboardShare', 'dashboardShare')
      .select([
        'dashboard.id',
        'dashboard.title',
        'dashboard.layout',
        'dashboard.seq',
        'dashboard.shareId',
        'dashboard.createdAt',
        'dashboard.updatedAt',
        'dashboardShare.uuid'
      ])
      .where('dashboard.id IN (:...ids)', { ids: findId })
      .orderBy('dashboard.updatedAt', 'DESC')
      .addOrderBy('dashboard.title', 'ASC')
      .getMany();
    
    // Layout JSON 파싱 및 데이터 정리
    const result = find_all.map(dashboard => {
      return {
        id: dashboard.id,
        title: dashboard.title,
        layout: JSON.parse(dashboard.layout),
        seq: dashboard.seq,
        shareId: dashboard.shareId,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt,
        uuid: dashboard.dashboardShare?.uuid
      };
    });
    
    return { status: ResponseStatus.SUCCESS, data: result };
  }
  // 기존 dashboard all

  async findOne(id: number) {
    // 최적화된 쿼리: 필요한 데이터만 선택적으로 로드
    const find_dashboard = await this.dashboardRepository
      .createQueryBuilder('dashboard')
      .leftJoinAndSelect('dashboard.dashboardShare', 'dashboardShare')
      .leftJoinAndSelect('dashboard.dashboardWidgets', 'dashboardWidgets')
      .leftJoinAndSelect('dashboardWidgets.widget', 'widget')
      .leftJoinAndSelect('widget.component', 'component')
      .select([
        'dashboard.id',
        'dashboard.title',
        'dashboard.layout',
        'dashboard.seq',
        'dashboard.shareId',
        'dashboard.createdAt',
        'dashboard.updatedAt',
        'dashboardShare.uuid',
        'dashboardWidgets.id',
        'widget.id',
        'widget.title',
        'widget.description',
        'widget.componentId',
        'widget.datasetType',
        'widget.datasetId',
        'widget.option',
        'component.type',
        'component.icon',
        'component.title',
        'component.description'
      ])
      .where('dashboard.id = :id', { id })
      .getOne();

    if (!find_dashboard) {
      return { status: ResponseStatus.ERROR, message: '대시보드가 존재하지 않습니다.' };
    }

    // Layout JSON 파싱
    find_dashboard.layout = JSON.parse(find_dashboard.layout);
    
    // Widget 데이터 변환
    const widgets = find_dashboard.dashboardWidgets.map(dw => {
      const widget = dw.widget;
      return {
        ...widget,
        option: JSON.parse(widget.option),
        componentType: widget.component?.type,
        icon: widget.component?.icon,
        componentTitle: widget.component?.title,
        componentDescription: widget.component?.description
      };
    });
    
    const return_obj = {
      id: find_dashboard.id,
      title: find_dashboard.title,
      layout: find_dashboard.layout,
      seq: find_dashboard.seq,
      shareId: find_dashboard.shareId,
      createdAt: find_dashboard.createdAt,
      updatedAt: find_dashboard.updatedAt,
      uuid: find_dashboard.dashboardShare?.uuid,
      widgets: widgets
    };
    
    console.log(return_obj);
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
      // 업데이트할 데이터
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
