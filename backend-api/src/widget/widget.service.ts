import { lockDashboardWrite } from '../dashboard/dashboard-write-lock';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { lockMetricSources } from '../metric/metric-write-lock';
import {
  lockSourceActor,
  assertSourceOwner,
  sourceWriteFields,
  sourceWriteTransaction,
} from '../database/source-write-lock';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from './tabel-query/entity/table-query.entity';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { Injectable, Optional } from '@nestjs/common';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { Repository } from 'typeorm';
import { Widget } from './entities/widget.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { Component } from '../component/entities/component.entity';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { TableQueryService } from './table-query/table-query.service';
import { CustomLoggerService } from '../common/logger/logger.service';
import {
  PaginationService,
  CursorPaginationOptions,
  OffsetPaginationOptions,
  PaginatedResponse,
} from '../common/pagination';

@Injectable()
export class WidgetService {
  constructor(
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
    @InjectRepository(Component)
    private componentRepository: Repository<Component>,
    private tableQueryService: TableQueryService,
    @Optional() private logger?: CustomLoggerService,
    @Optional() private paginationService?: PaginationService,
  ) {}

  /**
   * 위젯 생성
   * @param createWidget
   */
  async create(createWidget: CreateWidgetDto, actor?: number, epoch?: number) {
    createWidget = sourceWriteFields(createWidget, [
      'title',
      'description',
      'databaseId',
      'componentId',
      'datasetType',
      'datasetId',
      'tableName',
      'option',
      'delYn',
    ]);
    return sourceWriteTransaction(this.widgetRepository.manager, async manager => {
      await lockSourceActor(manager, actor, epoch);
      if (![DatasetType.TABLE, DatasetType.DATASET].includes(createWidget.datasetType))
        throw new BadRequestException('Invalid dataset type.');
      const dataset =
        createWidget.datasetType === DatasetType.DATASET
          ? await manager.findOne(Dataset, { where: { id: createWidget.datasetId } })
          : undefined;
      const sourceId = dataset?.databaseId ?? createWidget.databaseId;
      assertSourceOwner((await lockMetricSources(manager, [sourceId])).get(sourceId), actor);
      if (createWidget.datasetType === DatasetType.DATASET) {
        const current = await manager.findOne(Dataset, { where: { id: createWidget.datasetId } });
        if (!current || current.databaseId !== sourceId)
          throw new ConflictException('Dataset source changed.');
      }
      if (
        createWidget.datasetType === DatasetType.TABLE &&
        createWidget.tableName &&
        String(createWidget.tableName).length <= 0
      ) {
        return { status: ResponseStatus.ERROR, message: '필수 입력사항::::선택한 테이블명 ' };
      }

      // 테이블 선택해서 생성할 경우(DatasetType : TABLE), tablequery 아이템을 추가하고 추가된 id값을 넣어줘야 한다.
      if (createWidget.datasetType === DatasetType.TABLE) {
        const res = await this.tableQueryService.create(
          createWidget.databaseId,
          createWidget.tableName,
          actor,
          epoch,
          manager,
        );
        createWidget.datasetId = res.id;
      }
      // 데이터셋 선택해서 생성할 경우(DatasetType : DATASET) 그대로 insert
      createWidget.option = JSON.stringify(createWidget.option);

      const saveResult = await manager.save(Widget, {
        title: createWidget.title,
        description: createWidget.description,
        componentId: createWidget.componentId,
        datasetType: createWidget.datasetType,
        datasetId: createWidget.datasetId,
        option: createWidget.option,
        delYn: createWidget.delYn,
      });
      saveResult.option = JSON.parse(saveResult.option);
      return { status: ResponseStatus.SUCCESS, data: saveResult };
    });
  }

  /**
   * 위젯 목록 조회 (페이지네이션 지원)
   */
  async findAll(
    pagination?: CursorPaginationOptions | OffsetPaginationOptions,
  ): Promise<PaginatedResponse<any> | any> {
    // 페이지네이션이 없으면 기존 로직 사용 (하위 호환성)
    if (!pagination) {
      const find_all = await this.widgetRepository
        .createQueryBuilder('widget')
        .innerJoin(Component, 'component', 'component.id = widget.componentId')
        .select([
          'widget.*',
          'component.type as componentType',
          'component.icon as icon',
          'component.title as componentTitle',
          'component.description as componentDescription',
        ])
        .orderBy('widget.updatedAt', 'DESC')
        .addOrderBy('widget.title')
        .getRawMany();

      find_all.forEach(el => {
        try {
          (el as any).option = JSON.parse(el.option);
        } catch (error) {
          (el as any).option = {};
        }
      });
      return { status: ResponseStatus.SUCCESS, data: find_all };
    }

    // 페이지네이션 적용
    const queryBuilder = this.widgetRepository
      .createQueryBuilder('widget')
      .innerJoin('widget.component', 'component')
      .select([
        'widget.id',
        'widget.title',
        'widget.description',
        'widget.databaseId',
        'widget.componentId',
        'widget.datasetType',
        'widget.datasetId',
        'widget.tableName',
        'widget.option',
        'widget.createdAt',
        'widget.updatedAt',
        'component.id',
        'component.type',
        'component.icon',
        'component.title',
        'component.description',
      ])
      .where('widget.delYn = :delYn', { delYn: 'N' });

    const paginatedResult = await this.paginationService.paginate(queryBuilder, pagination, {
      alias: 'widget',
      defaultSortField: 'updatedAt',
      defaultSortDirection: 'DESC',
      cursorFields: ['updatedAt', 'title'],
      includeTotalCount: true,
    });

    // option 필드 JSON 파싱
    paginatedResult.data = paginatedResult.data.map(widget => {
      try {
        if (widget.option) {
          widget.option = JSON.parse(widget.option);
        }
      } catch (error) {
        widget.option = '{}';
      }
      return widget;
    });

    return paginatedResult;
  }

  async findOne(id: number) {
    // subQuery(): without it the builder keeps its own FROM next to from(Widget), so `id` is ambiguous.
    const widgetInfo = this.widgetRepository
      .createQueryBuilder()
      .subQuery()
      .select(['widget.*'])
      .from(Widget, 'widget')
      .where('id=:id')
      .getQuery();

    const find_widget = await this.componentRepository
      .createQueryBuilder('component')
      .select([
        'widgetInfo.*',
        'component.type as componentType',
        'component.icon as icon',
        'component.title as componentTitle',
        'component.description as componentDescription',
      ])
      .innerJoin(`(${widgetInfo})`, 'widgetInfo', 'widgetInfo.componentId = component.id')
      .setParameter('id', id)
      .getRawOne();

    let resultObj = {};
    if (!find_widget)
      resultObj = { status: ResponseStatus.ERROR, message: `${id} 위젯이 존재하지 않습니다.` };
    else {
      try {
        (find_widget as any).option = JSON.parse(find_widget.option);
      } catch (error) {
        (find_widget as any).option = {};
      }
      resultObj = { status: ResponseStatus.SUCCESS, data: find_widget };
    }
    return resultObj;
  }

  /**
   * 위젯 수정
   * @param id
   * @param updateWidget
   */
  async update(id: number, updateWidget: UpdateWidgetDto, actor?: number, epoch?: number) {
    updateWidget = sourceWriteFields(updateWidget, [
      'title',
      'description',
      'databaseId',
      'componentId',
      'datasetType',
      'datasetId',
      'tableName',
      'option',
      'delYn',
    ]);
    return sourceWriteTransaction(this.widgetRepository.manager, async manager => {
      await lockSourceActor(manager, actor, epoch);
      let find_widget = await manager.findOne(Widget, { where: { id } });
      if (!find_widget) {
        return { status: ResponseStatus.ERROR, message: `${id} 위젯이 존재하지 않습니다.` };
      } else {
        const target = find_widget.datasetType === DatasetType.DATASET ? Dataset : TableQuery;
        const linked = await manager.findOne(target as typeof Dataset, {
          where: { id: find_widget.datasetId },
        });
        if (!linked) throw new ConflictException('Dataset unavailable.');
        assertSourceOwner(
          (await lockMetricSources(manager, [linked.databaseId])).get(linked.databaseId),
          actor,
        );
        const currentLink = await manager.findOne(target as typeof Dataset, {
          where: { id: find_widget.datasetId },
        });
        const currentWidget = await manager.findOne(Widget, { where: { id } });
        if (
          !currentLink ||
          currentLink.databaseId !== linked.databaseId ||
          !currentWidget ||
          currentWidget.datasetId !== find_widget.datasetId ||
          currentWidget.datasetType !== find_widget.datasetType
        )
          throw new ConflictException('Widget source changed.');
        find_widget = currentWidget;
        // 변경 가능한 항목 넣어주기
        find_widget.option = JSON.stringify(updateWidget.option);
        if (updateWidget.delYn) {
          find_widget.delYn = updateWidget.delYn;
        }
        if (updateWidget.title) {
          find_widget.title = updateWidget.title;
        }
        if (updateWidget.componentId) {
          find_widget.componentId = updateWidget.componentId;
        }

        const saveResult = await manager.save(Widget, find_widget);
        saveResult.option = JSON.parse(saveResult.option);

        return { status: ResponseStatus.SUCCESS, data: saveResult };
      }
    });
  }

  /**
   * widget 삭제
   * @param id
   */
  async remove(id: number, actor?: number, epoch?: number) {
    return sourceWriteTransaction(this.widgetRepository.manager, async manager => {
      await lockSourceActor(manager, actor, epoch);
      const widget = await manager.findOne(Widget, { where: { id } });
      if (!widget) return { status: ResponseStatus.ERROR, message: 'No exist' };
      if (![DatasetType.DATASET, DatasetType.TABLE].includes(widget.datasetType))
        throw new ConflictException('Dataset unavailable.');
      const target = widget.datasetType === DatasetType.DATASET ? Dataset : TableQuery;
      const linked = await manager.findOne(target as typeof Dataset, {
        where: { id: widget.datasetId },
      });
      if (!linked) throw new ConflictException('Dataset unavailable.');
      const links = () => manager.find(DashboardWidget, { where: { widgetId: id } });
      const parents = new Set((await links()).map(link => link.dashboardId));
      for (const parent of [...parents].sort((a, b) => a - b))
        await lockDashboardWrite(manager, parent);
      // Never acquire a newly discovered Dashboard after the Source fence.
      assertSourceOwner(
        (await lockMetricSources(manager, [linked.databaseId])).get(linked.databaseId),
        actor,
      );
      const lock =
        manager.connection.options.type !== 'sqlite'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {};
      const current = await manager.findOne(Widget, { where: { id }, ...lock });
      const currentLink = await manager.findOne(target as typeof Dataset, {
        where: { id: widget.datasetId },
        ...lock,
      });
      if (
        !current ||
        current.datasetId !== widget.datasetId ||
        current.datasetType !== widget.datasetType ||
        !currentLink ||
        currentLink.databaseId !== linked.databaseId ||
        (await links()).some(link => !parents.has(link.dashboardId))
      )
        throw new ConflictException('Widget source changed.');
      if (widget.datasetType === DatasetType.TABLE)
        await manager.delete(TableQuery, widget.datasetId);
      await manager.delete(Widget, id);
      return { status: ResponseStatus.SUCCESS, message: `This action removes a #${id} widget` };
    });
  }
}
