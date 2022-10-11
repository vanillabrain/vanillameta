import { BadRequestException, HttpException, Injectable, HttpStatus } from '@nestjs/common';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { Repository } from 'typeorm';
import { Widget } from './entities/widget.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { WidgetViewController } from '../widget-view/widget-view.controller';
import { Component } from '../component/entities/component.entity';

@Injectable()
export class WidgetService {
  constructor(
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
    @InjectRepository(Component)
    private componentRepository: Repository<Component>,
    private widgetViewController: WidgetViewController,
  ) {}

  async create(createWidget: CreateWidgetDto) {
    if (createWidget.datasetType === DatasetType.WIDGET && createWidget.tableName.length <= 0) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error: '테이블명이 존재하지 않습니다.',
        },
        HttpStatus.FORBIDDEN,
      );
    } else if (createWidget.datasetType === DatasetType.DATASET && !createWidget.datasetId) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error: 'datasetId가 존재하지 않아',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // todo:: 테이블 선택해서 생성할 경우(DatasetType : WIDGET), 위젯 뷰 아이템을 추가하고 추가된 id값을 넣어줘야 한다.
    // todo:: 데이터셋 선택해서 생성할 경우 그대로 insert(DatasetType : DATASET)

    const res = await this.widgetViewController.widgetcreate(createWidget.databaseId);
    const saveObj: CreateWidgetDto = new CreateWidgetDto();

    saveObj.componentId = createWidget.componentId;
    saveObj.datasetType = createWidget.datasetType;
    saveObj.option = JSON.stringify(createWidget.option);
    saveObj.widgetViewId = res.id;

    if (createWidget.title) {
      saveObj.title = createWidget.title;
    }
    if (createWidget.datasetId) {
      saveObj.datasetId = createWidget.datasetId;
    }
    if (createWidget.description) {
      saveObj.description = createWidget.description;
    }
    if (createWidget.tableName) {
      saveObj.tableName = createWidget.tableName;
    }
    if (createWidget.databaseId) {
      saveObj.databaseId = createWidget.databaseId;
    } else {
      // saveObj.databaseId = res.data.id;
    }

    await this.widgetRepository.save(saveObj);
    return 'This action adds a new widget';
  }

  async findAll() {
    // const find_all = await this.widgetRepository.find();

    const find_all = await this.widgetRepository
      .createQueryBuilder('widget')
      .innerJoin(Component, 'component', 'component.id = widget.componentId')
      .select(['widget.*', 'component.type as componentType'])
      .orderBy('widget.updatedAt')
      .getRawMany();

    find_all.forEach(el => {
      el.option = JSON.parse(el.option);
    });
    return find_all;
  }

  async findOne(id: number) {
    const widgetInfo = this.widgetRepository
      .createQueryBuilder()
      .subQuery()
      .select(['widget.*'])
      .from(Widget, 'widget')
      .where('id=:id')
      .getQuery();

    const find_widget = await this.componentRepository
      .createQueryBuilder('component')
      .select(['widgetInfo.*', 'component.type as componentType'])
      .innerJoin(widgetInfo, 'widgetInfo', 'widgetInfo.componentId = component.id')
      .setParameter('id', id)
      .getRawOne();

    find_widget.option = JSON.parse(find_widget.option);
    return find_widget;
  }

  async update(id: number, updateWidget: UpdateWidgetDto) {
    const find_widget = await this.widgetRepository.findOne({ where: { id: id } }); //todo 테이블 확인필요
    if (!find_widget) {
      return 'No exist widget';
    } else {
      find_widget.datasetType = updateWidget.datasetType;
      find_widget.datasetId = updateWidget.datasetId;
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

      await this.widgetRepository.save(find_widget);

      return `This action updates a #${id} widget`;
    }
  }

  async remove(id: number) {
    const find_widget = await this.widgetRepository.findOne({ where: { id: id } });

    if (!find_widget) {
      return 'No exist';
    } else {
      await this.widgetViewController.remove(String(find_widget.widgetViewId));
      await this.widgetRepository.delete(id);
    }
    return `This action removes a #${id} widget`;
  }
}
