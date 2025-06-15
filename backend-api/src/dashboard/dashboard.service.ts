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
import {
  PaginationService,
  CursorPaginationOptions,
  OffsetPaginationOptions,
  PaginatedResponse,
} from '../common/pagination';

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
    private readonly paginationService: PaginationService,
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

  async findAll(
    userId: number,
    pagination?: CursorPaginationOptions | OffsetPaginationOptions,
  ): Promise<PaginatedResponse<any> | any> {
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

    // 페이지네이션이 없으면 기존 로직 사용 (하위 호환성)
    if (!pagination) {
      // N+1 쿼리 문제 해결: In 조건으로 한 번에 조회
      const find_all = await this.dashboardRepository
        .createQueryBuilder('dashboard')
        .where('dashboard.id IN (:...ids)', { ids: findId })
        .orderBy('dashboard.updatedAt', 'DESC')
        .addOrderBy('dashboard.title', 'ASC')
        .getMany();

      find_all.forEach(el => {
        console.log('adf,', el);
        el.layout = JSON.parse(el.layout);
      });
      return { status: ResponseStatus.SUCCESS, data: find_all };
    }

    // 페이지네이션 적용
    const queryBuilder = this.dashboardRepository
      .createQueryBuilder('dashboard')
      .where('dashboard.id IN (:...ids)', { ids: findId })
      .select([
        'dashboard.id',
        'dashboard.title',
        'dashboard.layout',
        'dashboard.shareId',
        'dashboard.createdAt',
        'dashboard.updatedAt',
      ]);

    const paginatedResult = await this.paginationService.paginate(queryBuilder, pagination, {
      alias: 'dashboard',
      defaultSortField: 'updatedAt',
      defaultSortDirection: 'DESC',
      cursorFields: ['updatedAt', 'title'],
      includeTotalCount: true,
    });

    // layout 필드 JSON 파싱
    paginatedResult.data = paginatedResult.data.map(dashboard => {
      try {
        if (dashboard.layout) {
          dashboard.layout = JSON.parse(dashboard.layout);
        }
      } catch (error) {
        dashboard.layout = '[]';
      }
      return dashboard;
    });

    return paginatedResult;
  }
  // 기존 dashboard all

  async findOne(id: number) {
    // N+1 쿼리 문제 해결: relations 옵션으로 관련 데이터를 한 번에 조회
    const find_dashboard = await this.dashboardRepository.findOne({
      where: { id: id },
      relations: ['dashboardShare'],
    });
    if (!find_dashboard) {
      return { status: ResponseStatus.ERROR, message: '대시보드가 존재하지 않습니다.' };
    }

    const widgetList = await this.dashboardWidgetService.findWidgets(find_dashboard.id);
    console.log('widgetList', widgetList);
    try {
      (find_dashboard as any).layout = JSON.parse(find_dashboard.layout);
    } catch (error) {
      (find_dashboard as any).layout = [];
    }

    const return_obj = {
      ...find_dashboard,
      uuid: find_dashboard.dashboardShare?.uuid,
      widgets: widgetList,
    };
    delete return_obj.dashboardShare;

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
