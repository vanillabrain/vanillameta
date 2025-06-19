import { Injectable } from '@nestjs/common';
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
    private logger: CustomLoggerService,
    private paginationService: PaginationService,
  ) {}

  /**
   * 위젯 생성
   * @param createWidget
   */
  async create(createWidget: CreateWidgetDto) {
    if (
      createWidget.datasetType === DatasetType.TABLE &&
      (!createWidget.tableName || String(createWidget.tableName).trim().length === 0)
    ) {
      return { status: ResponseStatus.ERROR, message: '필수 입력사항::::선택한 테이블명 ' };
    }

    // 테이블 선택해서 생성할 경우(DatasetType : TABLE), tablequery 아이템을 추가하고 추가된 id값을 넣어줘야 한다.
    if (createWidget.datasetType === DatasetType.TABLE) {
      const res = await this.tableQueryService.create(
        createWidget.databaseId,
        createWidget.tableName,
      );
      if (!res || !res.id) {
        return { status: ResponseStatus.ERROR, message: 'Failed to create table query' };
      }
      createWidget.datasetId = res.id;
    }
    // 데이터셋 선택해서 생성할 경우(DatasetType : DATASET) 그대로 insert
    createWidget.option = JSON.stringify(createWidget.option);

    const saveResult = await this.widgetRepository.save(createWidget);
    try {
      (saveResult as any).option = JSON.parse(saveResult.option);
    } catch (error) {
      (saveResult as any).option = {};
    }
    return { status: ResponseStatus.SUCCESS, data: saveResult };
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
    const widgetInfo = this.widgetRepository
      .createQueryBuilder()
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
  async update(id: number, updateWidget: UpdateWidgetDto) {
    const find_widget = await this.widgetRepository.findOne({ where: { id: id } });
    if (!find_widget) {
      return { status: ResponseStatus.ERROR, message: `${id} 위젯이 존재하지 않습니다.` };
    } else {
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

      const saveResult = await this.widgetRepository.save(find_widget);
      try {
        (saveResult as any).option = JSON.parse(saveResult.option);
      } catch (error) {
        (saveResult as any).option = {};
      }

      return { status: ResponseStatus.SUCCESS, data: saveResult };
    }
  }

  /**
   * widget 삭제
   * @param id
   */
  async remove(id: number) {
    const find_widget = await this.widgetRepository.findOne({ where: { id: id } });

    if (!find_widget) {
      return { status: ResponseStatus.ERROR, message: 'No exist' };
    } else {
      // dataset이 아닐경우
      if (find_widget.datasetType === DatasetType.TABLE) {
        try {
          await this.tableQueryService.remove(find_widget.datasetId);
        } catch (error) {
          // 테이블 쿼리 제거 실패해도 위젯 제거는 계속 진행
          this.logger.warn(`Failed to remove table query: ${error.message}`, 'WidgetService');
        }
      }
      await this.widgetRepository.delete(id);
      return { status: ResponseStatus.SUCCESS, message: `This action removes a #${id} widget` };
    }
  }
}
