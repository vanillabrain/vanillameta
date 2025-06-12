import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard } from '../entities/dashboard.entity';
import { UserMapping } from '../../user/entities/user-mapping.entity';
import { DashboardShare } from '../entities/dashboard_share.entity';

/**
 * 최적화된 대시보드 쿼리 클래스
 * 
 * 주요 최적화:
 * 1. N+1 쿼리 문제 해결
 * 2. 필요한 필드만 선택
 * 3. 적절한 인덱스 활용
 * 4. 조인 최적화
 */
@Injectable()
export class OptimizedDashboardQueries {
  constructor(
    @InjectRepository(Dashboard)
    private dashboardRepository: Repository<Dashboard>,
    @InjectRepository(UserMapping)
    private userMappingRepository: Repository<UserMapping>,
  ) {}

  /**
   * 사용자의 모든 대시보드 조회 (최적화)
   * 
   * 기존 문제점:
   * - UserMapping을 먼저 조회 후 Dashboard를 IN 절로 조회 (2개 쿼리)
   * - layout JSON 파싱이 애플리케이션 레벨에서 수행
   * 
   * 최적화:
   * - 단일 조인 쿼리로 변경
   * - 필요한 컬럼만 선택
   * - 인덱스 활용 (user_mapping.user_info_id, dashboard.id)
   */
  async findAllDashboardsForUser(userId: number) {
    return await this.dashboardRepository
      .createQueryBuilder('d')
      .innerJoin(UserMapping, 'um', 'um.dashboard_id = d.id')
      .leftJoin(DashboardShare, 'ds', 'd.share_id = ds.id')
      .select([
        'd.id',
        'd.title',
        'd.layout',
        'd.created_at',
        'd.updated_at',
        'ds.uuid',
      ])
      .where('um.user_info_id = :userId', { userId })
      .andWhere('d.del_yn = :delYn', { delYn: 'N' })
      .orderBy('d.updated_at', 'DESC')
      .addOrderBy('d.title', 'ASC')
      .getMany();
  }

  /**
   * 대시보드 상세 조회 (위젯 포함) - 최적화
   * 
   * 기존 문제점:
   * - Dashboard 조회 후 별도로 Widget 조회 (N+1)
   * - 각 Widget에 대해 Component 정보 조회 (N+1)
   * 
   * 최적화:
   * - 단일 쿼리로 모든 관련 데이터 조회
   * - 필요한 필드만 선택
   */
  async findDashboardWithWidgets(dashboardId: number) {
    const result = await this.dashboardRepository
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.dashboardShare', 'ds')
      .leftJoinAndSelect('d.dashboardWidgets', 'dw')
      .leftJoinAndSelect('dw.widget', 'w')
      .leftJoinAndSelect('w.component', 'c')
      .select([
        'd.id',
        'd.title',
        'd.layout',
        'd.created_at',
        'd.updated_at',
        'ds.uuid',
        'dw.id',
        'dw.widget_id',
        'w.id',
        'w.title',
        'w.option',
        'w.dataset_type',
        'w.dataset_id',
        'w.database_id',
        'w.component_id',
        'c.id',
        'c.type',
        'c.icon',
        'c.title',
        'c.description',
      ])
      .where('d.id = :dashboardId', { dashboardId })
      .andWhere('d.del_yn = :delYn', { delYn: 'N' })
      .getOne();

    if (result) {
      // layout 파싱은 여전히 필요하지만, 단일 쿼리로 모든 데이터 획득
      result.layout = JSON.parse(result.layout);
      
      // 위젯 옵션 파싱
      if (result.dashboardWidgets) {
        result.dashboardWidgets.forEach(dw => {
          if (dw.widget && dw.widget.option) {
            dw.widget.option = JSON.parse(dw.widget.option);
          }
        });
      }
    }

    return result;
  }

  /**
   * 대시보드 생성을 위한 최적화된 트랜잭션
   * 
   * 최적화:
   * - 트랜잭션 내에서 모든 작업 수행
   * - 불필요한 조회 제거
   */
  async createDashboardOptimized(
    createData: {
      title: string;
      layout: any;
      userId: number;
      widgetIds: string[];
    },
    queryRunner: any,
  ) {
    // 1. DashboardShare 생성
    const shareResult = await queryRunner.manager
      .createQueryBuilder()
      .insert()
      .into(DashboardShare)
      .values({
        uuid: require('uuid').v4(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();

    // 2. Dashboard 생성
    const dashboardResult = await queryRunner.manager
      .createQueryBuilder()
      .insert()
      .into(Dashboard)
      .values({
        title: createData.title,
        layout: JSON.stringify(createData.layout),
        delYn: 'N',
        shareId: shareResult.identifiers[0].id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();

    const dashboardId = dashboardResult.identifiers[0].id;

    // 3. UserMapping 생성
    await queryRunner.manager
      .createQueryBuilder()
      .insert()
      .into(UserMapping)
      .values({
        dashboardId,
        userInfoId: createData.userId,
        createdAt: new Date(),
      })
      .execute();

    // 4. DashboardWidget 매핑 (bulk insert)
    if (createData.widgetIds.length > 0) {
      const dashboardWidgetValues = createData.widgetIds.map(widgetId => ({
        dashboardId,
        widgetId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into('dashboard_widget')
        .values(dashboardWidgetValues)
        .execute();
    }

    return dashboardId;
  }

  /**
   * 대시보드 삭제 최적화
   * 
   * 최적화:
   * - CASCADE 삭제 대신 명시적 삭제로 성능 향상
   * - 트랜잭션 내에서 순서대로 삭제
   */
  async deleteDashboardOptimized(dashboardId: number, queryRunner: any) {
    // 1. DashboardWidget 삭제
    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from('dashboard_widget')
      .where('dashboard_id = :dashboardId', { dashboardId })
      .execute();

    // 2. UserMapping 삭제
    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from(UserMapping)
      .where('dashboard_id = :dashboardId', { dashboardId })
      .execute();

    // 3. Dashboard 조회 (share_id 획득)
    const dashboard = await queryRunner.manager
      .createQueryBuilder()
      .select(['dashboard.share_id'])
      .from(Dashboard, 'dashboard')
      .where('dashboard.id = :dashboardId', { dashboardId })
      .getOne();

    // 4. Dashboard 삭제
    await queryRunner.manager
      .createQueryBuilder()
      .delete()
      .from(Dashboard)
      .where('id = :dashboardId', { dashboardId })
      .execute();

    // 5. DashboardShare 삭제
    if (dashboard && dashboard.shareId) {
      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(DashboardShare)
        .where('id = :shareId', { shareId: dashboard.shareId })
        .execute();
    }
  }

  /**
   * 대시보드 통계 조회 (최적화)
   * 
   * 단일 쿼리로 여러 통계 정보 조회
   */
  async getDashboardStatistics(userId: number) {
    const result = await this.dashboardRepository
      .createQueryBuilder('d')
      .innerJoin(UserMapping, 'um', 'um.dashboard_id = d.id')
      .leftJoin('dashboard_widget', 'dw', 'dw.dashboard_id = d.id')
      .select([
        'COUNT(DISTINCT d.id) as total_dashboards',
        'COUNT(DISTINCT dw.widget_id) as total_widgets',
        'MAX(d.updated_at) as last_updated',
        'AVG(LENGTH(d.layout)) as avg_layout_size',
      ])
      .where('um.user_info_id = :userId', { userId })
      .andWhere('d.del_yn = :delYn', { delYn: 'N' })
      .getRawOne();

    return {
      totalDashboards: parseInt(result.total_dashboards) || 0,
      totalWidgets: parseInt(result.total_widgets) || 0,
      lastUpdated: result.last_updated,
      avgLayoutSize: parseFloat(result.avg_layout_size) || 0,
    };
  }
}