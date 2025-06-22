import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { DashboardCacheService } from './dashboard-cache.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { UserService } from 'src/user/user.service';
import { AuthService } from 'src/auth/auth.service';
import { User } from '../user/entities/user.entity';
import { YesNo } from 'src/common/enum/yn.enum';
import { DashboardShare } from 'src/dashboard/entities/dashboard_share.entity';
import { UserMapping } from 'src/user/entities/user-mapping.entity';
import { v4 as uuidv4 } from 'uuid';
import { CustomLoggerService } from '../common/logger/logger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
    private readonly dashboardCacheService: DashboardCacheService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly logger: CustomLoggerService,
    private readonly eventEmitter: EventEmitter2,
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
    // layout이 이미 배열인 경우와 문자열인 경우를 모두 처리
    if (typeof newDashboard.layout === 'string') {
      newDashboard.layout = JSON.parse(newDashboard.layout);
    }
    await this.dashboardWidgetService.create(saveObjDW);

    // 사용자 대시보드 목록 캐시 무효화
    await this.dashboardCacheService.invalidateUserDashboardList(accessToken);

    // 새 대시보드 이벤트 발생
    this.eventEmitter.emit('dashboard.created', {
      dashboardId: newDashboard.id,
      userId: accessToken,
      timestamp: Date.now(),
    });

    return { status: ResponseStatus.SUCCESS, data: newDashboard };
  }

  async findAll(userId: number) {
    const findUser = await this.userService.findDashboardId(userId);
    if (!findUser || findUser.length === 0) {
      // 빈 배열 반환 (대시보드가 없는 정상적인 상황)
      return { status: ResponseStatus.SUCCESS, data: [] };
    }
    console.log(findUser);
    const findId = findUser.map(el => el['dashboardId']);

    // null 값 필터링
    const validIds = findId.filter(id => id !== null && id !== undefined);
    if (validIds.length === 0) {
      // 대시보드가 없는 경우 빈 배열 반환
      return { status: ResponseStatus.SUCCESS, data: [] };
    }

    console.log(validIds);

    // N+1 쿼리 문제 해결: In 조건으로 한 번에 조회
    const find_all = await this.dashboardRepository
      .createQueryBuilder('dashboard')
      .where('dashboard.id IN (:...ids)', { ids: validIds })
      .orderBy('dashboard.updatedAt', 'DESC')
      .addOrderBy('dashboard.title', 'ASC')
      .getMany();

    if (find_all && find_all.length > 0) {
      find_all.forEach(el => {
        console.log('adf,', el);
        el.layout = JSON.parse(el.layout);
      });
    }
    return { status: ResponseStatus.SUCCESS, data: find_all || [] };
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

    // 대시보드를 캐시에 저장
    await this.dashboardCacheService.cacheDashboard(
      find_dashboard,
      widgetList,
      find_dashboard.dashboardShare,
    );

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

      // layout이 이미 배열인 경우와 문자열인 경우를 모두 처리
      if (typeof updatedDashboard.layout === 'string') {
        updatedDashboard.layout = JSON.parse(updatedDashboard.layout);
      }

      // 업데이트된 대시보드 캐시 무효화
      await this.dashboardCacheService.invalidateDashboard(id);

      // 대시보드 업데이트 이벤트 발생
      this.eventEmitter.emit('dashboard.updated', {
        dashboardId: id,
        timestamp: Date.now(),
      });

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
      // 캐시 무효화를 위해 userInfoId 저장
      const userInfoId = find_dashboardId?.userInfoId;

      await this.userMappingRepository.delete(find_dashboardId.id);
      await this.dashboardShareRepository.delete(find_dashboard.shareId);

      // 삭제된 대시보드 캐시 무효화
      await this.dashboardCacheService.invalidateDashboard(id);

      // 사용자 대시보드 목록 캐시도 무효화
      if (userInfoId) {
        await this.dashboardCacheService.invalidateUserDashboardList(userInfoId);
      }

      // 대시보드 삭제 이벤트 발생
      this.eventEmitter.emit('dashboard.deleted', {
        dashboardId: id,
        timestamp: Date.now(),
      });

      return {
        status: ResponseStatus.SUCCESS,
        data: { message: `This action removes a #${id} dashboard` },
      };
    }
  }
}
