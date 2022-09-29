import {BadRequestException, HttpException, Injectable, HttpStatus} from '@nestjs/common';
import {CreateWidgetDto} from './dto/create-widget.dto';
import {UpdateWidgetDto} from './dto/update-widget.dto';
import {Repository} from 'typeorm';
import {Widget} from './entities/widget.entity';
import {InjectRepository} from '@nestjs/typeorm';
import {DatasetType} from '../common/enum/dataset-type.enum';
import axios from "axios";


@Injectable()
export class WidgetService {
    constructor(
        @InjectRepository(Widget)
        private widgetRepository: Repository<Widget>,
    ) {
    }

    async create(createWidget: CreateWidgetDto) {
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
            createWidget.datasetType === DatasetType.WIDGET &&
            createWidget.tableName.length <= 0
        ) {

            throw new HttpException({
                status: HttpStatus.FORBIDDEN,
                error: '테이블명이 존재하지 않습니다.',
            }, HttpStatus.FORBIDDEN);

        } else if (createWidget.datasetType === DatasetType.DATASET && !createWidget.datasetId) {
            throw new HttpException({
                status: HttpStatus.FORBIDDEN,
                error: 'datasetId가 존재하지 않아',
            }, HttpStatus.FORBIDDEN);
        }

        // todo:: 테이블 선택해서 생성할 경우(DatasetType : WIDGET), 위젯 뷰 아이템을 추가하고 추가된 id값을 넣어줘야 한다.
        // todo:: 데이터셋 선택해서 생성할 경우 그대로 insert(DatasetType : DATASET)
        const find_widget = await this.widgetRepository.findOne({where: {datasetId: createWidget.datasetId}})

        createWidget.option = JSON.stringify(createWidget.option);
        const url = process.env.DB_HOTS
        const test_url = 'http://localhost:4000/widget-view'
        const res = await axios.post(test_url, {
            databaseId: createWidget.databaseId
        })


        const saveObj: CreateWidgetDto = new CreateWidgetDto();
        saveObj.componentId = createWidget.componentId;
        saveObj.datasetType = createWidget.datasetType;
        saveObj.option = createWidget.option;
        saveObj.widgetViewId = res.data.id;

        if (createWidget.title) {
            saveObj.title = createWidget.title
        }
        ;
        if (createWidget.datasetId) {
            saveObj.datasetId = createWidget.datasetId
        }
        if (createWidget.description) {
            saveObj.description = createWidget.description
        }
        ;
        if (createWidget.tableName) {
            saveObj.tableName = createWidget.tableName
        }
        ;
        if (createWidget.databaseId) {
            saveObj.databaseId = createWidget.databaseId;
        } else {
            saveObj.databaseId = res.data.id;
        }


        await this.widgetRepository.save(saveObj)
        return 'This action adds a new widget';


    }

    async findAll() {
        const find_all = await this.widgetRepository.find();
        return find_all;
    }

    async findOne(id: number) {
        const find_widget = await this.widgetRepository.findOne({where: {id: id}});
        return find_widget;
    }

    async update(id: number, updateWidget: UpdateWidgetDto) {
        const find_widget = await this.widgetRepository.findOne({where: {id: id}}); //todo 테이블 확인필요
        if (!find_widget) {
            return 'No exist widget';
        } else {
            const updateObj: UpdateWidgetDto = new UpdateWidgetDto();

            updateObj.title = updateWidget.title;
            updateObj.componentId = updateWidget.componentId;
            updateObj.datasetType = updateWidget.datasetType;
            updateObj.datasetId = updateWidget.datasetId;
            updateObj.option = JSON.stringify(updateWidget.option)


            if (updateWidget.delYn) {
                updateObj.delYn = updateWidget.delYn
            }

            // find_widget.widgetViewId = body.widgetViewId;

            await this.widgetRepository.save(updateObj);

            return `This action updates a #${id} widget`;
        }
    }

    async remove(id: number) {
        const find_widget = await this.widgetRepository.findOne({where: {id: id}});

        if (!find_widget) {
            return 'No exist'
        } else {
            await this.widgetRepository.delete(find_widget.id)
        }
        return `This action removes a #${id} widget`;
    }
}
