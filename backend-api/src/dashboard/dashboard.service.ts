import { Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Dashboard } from "./entities/dashboard.entity"
import { DashboardWidgetController } from "../dashboard-widget/dashboard-widget.controller";

@Injectable()
export class DashboardService {
  constructor(
      @InjectRepository(Dashboard)
      private dashboardRepository: Repository<Dashboard>,
      private dashboardWidgetController: DashboardWidgetController
  ) {}

  async create(createDashboardDto: CreateDashboardDto) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id: createDashboardDto.dashboardId }})
    if(find_dashboard){
      return "already exist dashboard"
    } else {
      const saveObj = createDashboardDto
      saveObj.layout = JSON.stringify(saveObj.layout)
      await this.dashboardRepository.save(saveObj)
      // TODO 테스트 끝나고 실제 실행 시 주석 제거

      const saveObjDW = {
        dashboardId: saveObj.dashboardId,
        widgetIds: saveObj.layout
      }
      await this.dashboardWidgetController.create(saveObjDW)
    }
    return 'This action adds a new dashboard';
  }

  async findAll() {
    const find_all = await this.dashboardRepository.find();
    find_all.forEach(el => {
      el.layout = JSON.parse(el.layout)
    })
    return find_all
  }

  async findOne(id: number) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id: id}})
    const find_widget = await this.dashboardWidgetController.findOne(String(id));

    find_dashboard.layout = JSON.parse(find_dashboard.layout)
    const return_obj ={
      find_dashboard,
      widget: find_widget
    }

    return return_obj
  }

  async update(id: number, updateDashboardDto: UpdateDashboardDto) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id : id}})


    if(!find_dashboard) { return 'Not exist dashboard' }
    else {
      if (updateDashboardDto.title) { find_dashboard.title = updateDashboardDto.title };
      if (updateDashboardDto.layout) { find_dashboard.layout = JSON.stringify( updateDashboardDto.layout )}
      const saveObj = {
        widgetIds: JSON.stringify(updateDashboardDto.layout)
      }
      await this.dashboardWidgetController.update(String(id), saveObj)
      return await this.dashboardRepository.save(find_dashboard);
    }
  }

  async remove(id: number) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id: id }})
    if (!find_dashboard) { return 'No exist dashboard' }
    else {
      await this.dashboardRepository.delete(id)
      await this.dashboardWidgetController.remove(String(id))
      return `This action removes a #${id} dashboard`
    };

  }
}
