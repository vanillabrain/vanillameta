import { Injectable } from '@nestjs/common';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { Repository } from "typeorm";
import { Widget } from "./entities/widget.entity";
import { InjectRepository } from "@nestjs/typeorm";

@Injectable()
export class WidgetService {
  constructor(
      @InjectRepository(Widget)
      private widgetRepository: Repository<Widget>) {}

  async create(body: CreateWidgetDto) {

    const find_widget = await this.widgetRepository.findOne({where: { title: body.title }})
    if(find_widget){
      return 'exist same widget'
    } else {
      await this.widgetRepository.save({
        title: body.title,
        description: body.description,
        componentId: body.componentId,
        datasetType: body.datasetType,
        datasetId: body.datasetId,
        option: JSON.stringify(body.option),
        delYn: body.delYn
      })
    }
    return 'This action adds a new widget';
  }

  async findAll() {
    const find_all = await this.widgetRepository.find()
    return find_all
  }

  async findOne(id: number) {

    const find_widget = await this.widgetRepository.findOne({ where: { id: id }})
    return find_widget;
  }

  async update(id: number, body: UpdateWidgetDto) {
    const find_widget = await this.widgetRepository.findOne({ where: { id: id}})
    if(!find_widget){
      return 'No exist widget'
    } else {

      find_widget.title = body.title;
      find_widget.componentId = body.componentId;
      find_widget.datasetType = body.datasetType;
      find_widget.datasetId = body.datasetId;
      find_widget.option = JSON.stringify(body.option);
      find_widget.delYn = body.delYn;
      find_widget.widgetViewId = body.widgetViewId;

      await this.widgetRepository.save(find_widget)

      return `This action updates a #${id} widget`;
    }

  }

  remove(id: number) {
    return `This action removes a #${id} widget`;
  }
}
