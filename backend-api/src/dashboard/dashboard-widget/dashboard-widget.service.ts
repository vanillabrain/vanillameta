import { Injectable } from '@nestjs/common';
import { CreateDashboardWidgetDto } from './dto/create-dashboard-widget.dto';
import { UpdateDashboardWidgetDto } from './dto/update-dashboard-widget.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DashboardWidget } from './entities/dashboard-widget.entity';
import { In, Repository } from 'typeorm';
import { Widget } from '../../widget/entities/widget.entity';

@Injectable()
export class DashboardWidgetService {
  constructor(
    @InjectRepository(DashboardWidget)
    private dashboardWidgetRepository: Repository<DashboardWidget>,
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
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
    const widgetList = await this.dashboardWidgetRepository.find({
      select: {
        widgetId: true,
      },
      where: { dashboardId: dashboardId },
    });

    const whereInWidgetList = [];
    widgetList.map(item => {
      whereInWidgetList.push(item.widgetId);
    });
    console.log(whereInWidgetList);

    const result = await this.widgetRepository.findBy({ id: In(whereInWidgetList) });
    result.map(el => {
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
