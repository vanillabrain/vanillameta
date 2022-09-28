import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { Repository } from 'typeorm';
import { Widget } from './entities/widget.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DatasetType } from '../common/enum/dataset-type.enum';

@Injectable()
export class WidgetService {
  constructor(
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
  ) {}

  async create(createWidgetDto: CreateWidgetDto) {
    // const find_widget = await this.widgetRepository.findOne({where: { title: createWidgetDto.title }})
    // if(find_widget){
    //   return 'exist same widget'
    // } else {
    // await this.widgetRepository.save({
    //   title: body.title,
    //   description: body.description,
    //   componentId: body.componentId,
    //   datasetType: body.datasetType,
    //   datasetId: body.datasetId,
    //   option: JSON.stringify(body.option),
    //   delYn: body.delYn
    // })
    // }

    if (
      createWidgetDto.datasetType === DatasetType.WIDGET &&
      createWidgetDto.tableName.length <= 0
    ) {
      throw new BadRequestException('테이블명이 존재하지 않습니다.');
    } else if (createWidgetDto.datasetType === DatasetType.DATASET && !createWidgetDto.datasetId) {
      throw new BadRequestException('datasetId가 존재하지 않아');
    }

    // todo:: 테이블 선택해서 생성할 경우(DatasetType : WIDGET), 위젯 뷰 아이템을 추가하고 추가된 id값을 넣어줘야 한다.
    // todo:: 데이터셋 선택해서 생성할 경우 그대로 insert(DatasetType : DATASET)

    createWidgetDto.option = JSON.stringify(createWidgetDto.option);

    return 'This action adds a new widget';
  }

  async findAll() {
    const find_all = await this.widgetRepository.find();
    return find_all;
  }

  async findOne(id: number) {
    const find_widget = await this.widgetRepository.findOne({ where: { id: id } });
    return find_widget;
  }

  async update(id: number, body: UpdateWidgetDto) {
    const find_widget = await this.widgetRepository.findOne({ where: { id: id } });
    if (!find_widget) {
      return 'No exist widget';
    } else {
      find_widget.title = body.title;
      find_widget.componentId = body.componentId;
      find_widget.datasetType = body.datasetType;
      find_widget.datasetId = body.datasetId;
      find_widget.option = JSON.stringify(body.option);
      // find_widget.delYn = body.delYn;
      // find_widget.widgetViewId = body.widgetViewId;

      await this.widgetRepository.save(find_widget);

      return `This action updates a #${id} widget`;
    }
  }

  remove(id: number) {
    return `This action removes a #${id} widget`;
  }
}
