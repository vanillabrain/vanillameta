import { Injectable } from '@nestjs/common';
import { CreateDashboardWidgetDto } from './dto/create-dashboard-widget.dto';
import { UpdateDashboardWidgetDto } from './dto/update-dashboard-widget.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DashboardWidget } from './entities/dashboard-widget.entity';
import { In, Repository } from 'typeorm';
import { Widget } from '../../widget/entities/widget.entity';
import { Component } from '../../component/entities/component.entity';

@Injectable()
export class DashboardWidgetService {
  constructor(
    @InjectRepository(DashboardWidget)
    private dashboardWidgetRepository: Repository<DashboardWidget>,
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
    @InjectRepository(Component)
    private componentRepository: Repository<Component>,
  ) {}

  /**
   * 대시보드에 해당하는 widget 목록 저장
   * @param createDashboardWidgetDto
   */
  async create(createDashboardWidgetDto: CreateDashboardWidgetDto) {
    const { dashboardId, widgetIds } = createDashboardWidgetDto;

    const saveList = [];
    widgetIds.map(item => {
      saveList.push({ dashboardId, widgetId: item });
    });

    return await this.dashboardWidgetRepository.save(saveList);
  }

  async findWidgets(dashboardId: number) {
    // N+1 쿼리 방지: 한 번의 Join 쿼리로 위젯과 컴포넌트 정보를 함께 조회
    const result = await this.widgetRepository
      .createQueryBuilder('widget')
      .innerJoin(Component, 'component', 'component.id = widget.componentId')
      .innerJoin(DashboardWidget, 'dw', 'dw.widgetId = widget.id')
      .select([
        'widget.*',
        'component.type as componentType',
        'component.icon as icon',
        'component.title as componentTitle',
        'component.description as componentDescription',
      ])
      .where('dw.dashboardId = :dashboardId', { dashboardId })
      .getRawMany();

    result.forEach(el => {
      el.option = JSON.parse(el.option);
    });

    return result;
  }

  async update(dashboardId: number, updateDashboardWidgetDto: UpdateDashboardWidgetDto) {
    // 전체 지우고, 다시 insert
    await this.dashboardWidgetRepository.delete({ dashboardId });

    const saveList = [];
    updateDashboardWidgetDto.widgetIds.map(item => {
      saveList.push({ dashboardId, widgetId: item });
    });

    await this.dashboardWidgetRepository.save(saveList);
  }

  async remove(dashboardId: number) {
    await this.dashboardWidgetRepository.delete({ dashboardId });
    return `This action removes a #${dashboardId} dashboardWidget`;
  }
}
