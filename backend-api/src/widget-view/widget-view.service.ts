import { Injectable } from '@nestjs/common';
import { CreateWidgetViewDto } from './dto/create-widget-view.dto';
import { UpdateWidgetViewDto } from './dto/update-widget-view.dto';

@Injectable()
export class WidgetViewService {
  create(createWidgetViewDto: CreateWidgetViewDto) {


    return 'This action adds a new widgetView';
  }

  findAll() {
    return `This action returns all widgetView`;
  }

  findOne(id: number) {
    return `This action returns a #${id} widgetView`;
  }

  update(id: number, updateWidgetViewDto: UpdateWidgetViewDto) {
    return `This action updates a #${id} widgetView`;
  }

  remove(id: number) {
    return `This action removes a #${id} widgetView`;
  }
}
