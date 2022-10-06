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
      // await this.dashboardRepository.save(saveObj)
      // TODO 테스트 끝나고 실제 실행 시 주석 제거

      const saveObjDW = {
        dashboardId: saveObj.dashboardId,
        widgetId: saveObj.layout
      }
      await this.dashboardWidgetController.create(saveObjDW)
    }
    return 'This action adds a new dashboard';
  }

  async findAll() {
    const find_all = await this.dashboardRepository.find();
    return find_all
  }

  findOne(id: number) {
    return `This action returns a #${id} dashboard`;
  }

  update(id: number, updateDashboardDto: UpdateDashboardDto) {
    return `This action updates a #${id} dashboard`;
  }

  remove(id: number) {
    return `This action removes a #${id} dashboard`;
  }
}
