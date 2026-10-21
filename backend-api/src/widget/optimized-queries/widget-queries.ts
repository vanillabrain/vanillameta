import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Widget } from '../entities/widget.entity';
import { Component } from '../../component/entities/component.entity';
import { DatasetType } from '../../common/enum/dataset-type.enum';

/**
 * 최적화된 위젯 쿼리 클래스
 *
 * 주요 최적화:
 * 1. 조인 쿼리 최적화
 * 2. 필요한 필드만 선택
 * 3. 인덱스 활용
 * 4. JSON 파싱 최소화
 */
@Injectable()
export class OptimizedWidgetQueries {
  constructor(
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
    @InjectRepository(Component)
    private componentRepository: Repository<Component>,
  ) {}

  /**
   * 모든 위젯 조회 (최적화)
   *
   * 기존 문제점:
   * - getRawMany()로 인한 타입 안정성 부족
   * - 모든 위젯의 option JSON 파싱
   *
   * 최적화:
   * - TypeORM의 관계 로딩 활용
   * - 페이지네이션 지원
   * - 필요한 경우에만 JSON 파싱
   */
  async findAllWidgetsOptimized(options?: {
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 100;
    const skip = (page - 1) * limit;

    const query = this.widgetRepository
      .createQueryBuilder('widget')
      .innerJoinAndSelect('widget.component', 'component')
      .select([
        'widget.id',
        'widget.title',
        'widget.option',
        'widget.datasetType',
        'widget.datasetId',
        'widget.databaseId',
        'widget.componentId',
        'widget.createdAt',
        'widget.updatedAt',
        'widget.delYn',
        'component.id',
        'component.type',
        'component.icon',
        'component.title',
        'component.description',
      ])
      .orderBy('widget.updatedAt', 'DESC')
      .addOrderBy('widget.title', 'ASC')
      .skip(skip)
      .take(limit);

    if (!options?.includeDeleted) {
      query.where('widget.delYn = :delYn', { delYn: 'N' });
    }

    const [widgets, total] = await query.getManyAndCount();

    // 옵션 파싱 (필요한 경우에만)
    const parsedWidgets = widgets.map(widget => ({
      ...widget,
      option: typeof widget.option === 'string' ? JSON.parse(widget.option) : widget.option,
    }));

    return {
      data: parsedWidgets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 위젯 단일 조회 (최적화)
   *
   * 최적화:
   * - 단일 쿼리로 모든 관련 정보 조회
   * - 불필요한 서브쿼리 제거
   */
  async findWidgetByIdOptimized(widgetId: number) {
    const widget = await this.widgetRepository
      .createQueryBuilder('widget')
      .innerJoinAndSelect('widget.component', 'component')
      .leftJoinAndSelect('widget.dataset', 'dataset')
      .leftJoinAndSelect('widget.tableQuery', 'tableQuery')
      .where('widget.id = :widgetId', { widgetId })
      .andWhere('widget.delYn = :delYn', { delYn: 'N' })
      .getOne();

    if (widget && widget.option) {
      widget.option = JSON.parse(widget.option);
    }

    return widget;
  }

  /**
   * 대시보드별 위젯 조회 (최적화)
   *
   * 최적화:
   * - 대시보드 ID로 직접 조인
   * - 위젯 순서 정보 포함
   */
  async findWidgetsByDashboardOptimized(dashboardId: number) {
    const result = await this.widgetRepository
      .createQueryBuilder('w')
      .innerJoin('dashboard_widget', 'dw', 'dw.widget_id = w.id')
      .innerJoinAndSelect('w.component', 'c')
      .select([
        'w.id',
        'w.title',
        'w.option',
        'w.datasetType',
        'w.datasetId',
        'w.databaseId',
        'w.componentId',
        'dw.created_at as added_at',
        'c.id',
        'c.type',
        'c.icon',
        'c.title',
        'c.description',
      ])
      .where('dw.dashboard_id = :dashboardId', { dashboardId })
      .andWhere('w.delYn = :delYn', { delYn: 'N' })
      .orderBy('dw.created_at', 'ASC')
      .getRawAndEntities();

    // 결과 매핑
    return result.entities.map((widget, index) => ({
      ...widget,
      option: JSON.parse(widget.option),
      addedAt: result.raw[index].added_at,
    }));
  }

  /**
   * 데이터베이스별 위젯 조회 (최적화)
   *
   * 특정 데이터베이스를 사용하는 모든 위젯 조회
   */
  async findWidgetsByDatabaseOptimized(databaseId: number) {
    return await this.widgetRepository
      .createQueryBuilder('w')
      .innerJoinAndSelect('w.component', 'c')
      .where('w.databaseId = :databaseId', { databaseId })
      .andWhere('w.delYn = :delYn', { delYn: 'N' })
      .select(['w.id', 'w.title', 'w.datasetType', 'w.datasetId', 'c.type'])
      .getMany();
  }

  /**
   * 위젯 생성 (최적화)
   *
   * 최적화:
   * - 불필요한 조회 제거
   * - 트랜잭션 활용
   */
  async createWidgetOptimized(
    createData: {
      title: string;
      option: any;
      componentId: number;
      datasetType: DatasetType;
      datasetId: number;
      databaseId: number;
    },
    queryRunner: any,
  ) {
    const result = await queryRunner.manager
      .createQueryBuilder()
      .insert()
      .into(Widget)
      .values({
        ...createData,
        option: JSON.stringify(createData.option),
        delYn: 'N',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();

    return result.identifiers[0].id;
  }

  /**
   * 위젯 벌크 업데이트 (최적화)
   *
   * 여러 위젯을 한 번에 업데이트
   */
  async bulkUpdateWidgetsOptimized(
    updates: Array<{
      id: number;
      title?: string;
      option?: any;
    }>,
    queryRunner: any,
  ) {
    // 업데이트를 그룹화하여 최소한의 쿼리 실행
    const updatePromises = updates.map(update => {
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (update.title) updateData.title = update.title;
      if (update.option) updateData.option = JSON.stringify(update.option);

      return queryRunner.manager
        .createQueryBuilder()
        .update(Widget)
        .set(updateData)
        .where('id = :id', { id: update.id })
        .execute();
    });

    return await Promise.all(updatePromises);
  }

  /**
   * 위젯 통계 조회 (최적화)
   *
   * 컴포넌트 타입별 위젯 수 등 통계 정보
   */
  async getWidgetStatistics() {
    const stats = await this.widgetRepository
      .createQueryBuilder('w')
      .innerJoin('w.component', 'c')
      .select([
        'c.type as component_type',
        'COUNT(w.id) as widget_count',
        'w.datasetType as dataset_type',
        'COUNT(DISTINCT w.databaseId) as database_count',
      ])
      .where('w.delYn = :delYn', { delYn: 'N' })
      .groupBy('c.type')
      .addGroupBy('w.datasetType')
      .getRawMany();

    // 결과 정리
    const componentStats = new Map<string, number>();
    const datasetTypeStats = new Map<string, number>();
    let totalDatabases = 0;

    stats.forEach(stat => {
      const count = parseInt(stat.widget_count);

      // 컴포넌트 타입별 집계
      const currentComponentCount = componentStats.get(stat.component_type) || 0;
      componentStats.set(stat.component_type, currentComponentCount + count);

      // 데이터셋 타입별 집계
      const currentDatasetCount = datasetTypeStats.get(stat.dataset_type) || 0;
      datasetTypeStats.set(stat.dataset_type, currentDatasetCount + count);

      // 총 데이터베이스 수
      totalDatabases = Math.max(totalDatabases, parseInt(stat.database_count));
    });

    return {
      totalWidgets: Array.from(componentStats.values()).reduce((a, b) => a + b, 0),
      byComponentType: Object.fromEntries(componentStats),
      byDatasetType: Object.fromEntries(datasetTypeStats),
      totalDatabasesUsed: totalDatabases,
    };
  }

  /**
   * 사용하지 않는 위젯 정리 (최적화)
   *
   * 대시보드에 연결되지 않은 위젯 찾기
   */
  async findUnusedWidgets() {
    return await this.widgetRepository
      .createQueryBuilder('w')
      .leftJoin('dashboard_widget', 'dw', 'dw.widget_id = w.id')
      .where('dw.id IS NULL')
      .andWhere('w.delYn = :delYn', { delYn: 'N' })
      .select(['w.id', 'w.title', 'w.createdAt'])
      .getMany();
  }
}
