import {Injectable} from '@nestjs/common';
import {CreateWidgetViewDto} from './dto/create-widget-view.dto';
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {WidgetView} from "./entities/widget-view.entity";

@Injectable()
export class WidgetViewService {
    constructor(
        @InjectRepository(WidgetView)
        private widgetViewRepository: Repository<WidgetView>,
    ) {
    }

    async create(createWidgetView: CreateWidgetViewDto) {

        const saveObj: CreateWidgetViewDto = new CreateWidgetViewDto();
        saveObj.databaseId = createWidgetView.databaseId;
        saveObj.query = 'SELECT * FROM widget_view';
        return await this.widgetViewRepository.save(saveObj)

    }

    async findAll() {

        return await this.widgetViewRepository.find();
    }

    async findOne(id: number) {
        const find_widget_view = await this.widgetViewRepository.findOne({where: {id: id}})
        if (find_widget_view) {
            return 'not exist'
        } else {
            return find_widget_view
        }
    }

    // async update(id: number, updateWidgetView: UpdateWidgetViewDto) {
    //
    //     const find_widget_view = await this.widgetViewRepository.findOne({where: {id: id}})
    //     if (!find_widget_view) {
    //         return 'No exist widget'
    //     } else {
    //         const updateObj: UpdateWidgetViewDto = new UpdateWidgetViewDto();
    //
    //         updateObj.databaseId = updateWidgetView.databaseId; // TODO 필요한가?
    //     }
    //     return `This action updates a #${id} widgetView`;
    // }

    async remove(id: number) {
        const find_widget_view = await this.widgetViewRepository.findOne({where: {id: id}});
        if (!find_widget_view) {
            return 'No exist'
        } else {
            await this.widgetViewRepository.delete(find_widget_view)
        }

        return `This action removes a #${id} widgetView`;
    }
}
