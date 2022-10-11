import { Injectable } from '@nestjs/common';
import { CreateDashboardWidgetDto } from './dto/create-dashboard-widget.dto';
import { UpdateDashboardWidgetDto } from './dto/update-dashboard-widget.dto';
import { InjectRepository } from "@nestjs/typeorm";
import { DashboardWidget } from "./entities/dashboard-widget.entity";
import { Repository, In } from "typeorm";
import { Widget } from "../widget/entities/widget.entity";

@Injectable()
export class DashboardWidgetService {
  constructor (
    @InjectRepository(DashboardWidget)
    private dashboardWidgetRepository: Repository<DashboardWidget>,
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>
  ) {}

  async create(createDashboardWidgetDto: CreateDashboardWidgetDto) {
    const { dashboardId, widgetIds } = createDashboardWidgetDto
       const widget_id = JSON.parse(widgetIds).map(el => el.i)

       const saveObj: CreateDashboardWidgetDto = new CreateDashboardWidgetDto();
       saveObj.dashboardId = dashboardId
       saveObj.widgetIds = JSON.stringify(widget_id);

    const find_dashboard = await this.dashboardWidgetRepository.findOne({ where: { dashboardId: dashboardId }})

    if (find_dashboard) { return 'already exist dashboardId !'}
    else { return await this.dashboardWidgetRepository.save(saveObj) }

  }

  findAll() {
    return `This action returns all dashboardWidget`;
  }

  async findOne(id: number) {
    const find_widgetId = await this.dashboardWidgetRepository.findOne({ where: { id: id }})
    const widget_list = find_widgetId.widgetIds

      const result = await this.widgetRepository.findBy({ id: In(JSON.parse(widget_list))})
      result.map(el => {
        el.option = JSON.parse(el.option)
      })

    return result;
  }

  async update(id: number, updateDashboardWidgetDto: UpdateDashboardWidgetDto) {
    const find_widget_id = await this.dashboardWidgetRepository.findOne({ where: {id: id}})
    const widget_id = JSON.parse(updateDashboardWidgetDto.widgetIds).map(el => el.i)
    find_widget_id.widgetIds = JSON.stringify(widget_id)
    await this.dashboardWidgetRepository.save(find_widget_id)
    return `This action updates a #${id} dashboardWidget`;
  }

  async remove(id: number) {
    await this.dashboardWidgetRepository.delete(id)
    return `This action removes a #${id} dashboardWidget`;
  }
}
