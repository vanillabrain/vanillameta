import { Injectable } from '@nestjs/common';
import { CreateDashboardWidgetDto } from './dto/create-dashboard-widget.dto';
import { UpdateDashboardWidgetDto } from './dto/update-dashboard-widget.dto';

@Injectable()
export class DashboardWidgetService {
  create(createDashboardWidgetDto: CreateDashboardWidgetDto) {
    return 'This action adds a new dashboardWidget';
  }

  findAll() {
    return `This action returns all dashboardWidget`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dashboardWidget`;
  }

  update(id: number, updateDashboardWidgetDto: UpdateDashboardWidgetDto) {
    return `This action updates a #${id} dashboardWidget`;
  }

  remove(id: number) {
    return `This action removes a #${id} dashboardWidget`;
  }
}
