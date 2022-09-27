import {Injectable} from '@nestjs/common';
import {CreateComponentDto} from './dto/create-component.dto';
import {InjectRepository} from "@nestjs/typeorm";
import {Component} from "./entities/component.entity";
import {Repository} from "typeorm";
import {YesNo} from "../common/enum/yn.enum";

@Injectable()
export class ComponentService {
    constructor(
        @InjectRepository(Component)
        private componentRepository: Repository<Component>) {
    }

    async multipleCreate(createComponents: CreateComponentDto[]) {
        // await this.componentRepository.save(createComponents);
        // for(let i =0 ; createComponents.length > i; i ++){
        //     const createComponentDto = createComponents[i];
        //     const find_component = await this.componentRepository.findOne({ where: { title: body[i].title }})
        //
        //     if(!find_component){
        //
        //       await this.componentRepository.save({
        //         type: body[i].type,
        //         title: body[i].title,
        //         description: body[i].description,
        //         category: body[i].category,
        //         icon: body[i].icon,
        //         option: JSON.stringify(body[i].option),
        //         seq: body[i].seq,
        //         uesYn: body[i].useYn
        //       })
        //       return 'success add a new component'
        //     }
        //   }

        createComponents.forEach((item) => {
            item.option = JSON.stringify(item.option);
        })

        return await this.componentRepository.save(createComponents);
    }

    // async shortCreate(body: CreateComponentDto) {
    //   const find_component = await this.componentRepository.findOne({ where: { title: body.title }})
    //   if(find_component){
    //     return 'exist same widget'
    //   } else {
    //     await this.componentRepository.save({
    //       type: body.type,
    //       title: body.title,
    //       description: body.description,
    //       category: body.category,
    //       icon: body.icon,
    //       option: JSON.stringify(body.option),
    //       seq: body.seq,
    //       uesYn: body.useYn
    //     })
    //   }
    //   return 'This action adds a new widget';
    // }

    async create(createComponent: CreateComponentDto) {
        const find_component = await this.componentRepository.findOne({where: {type: createComponent.type}})
        if (find_component) {
            return 'exist same widget'
        } else {
            const saveObj: CreateComponentDto = new CreateComponentDto();
            saveObj.type = createComponent.type;
            saveObj.title = createComponent.title;
            saveObj.category = createComponent.category;
            saveObj.option = JSON.stringify(createComponent.option);

            if (createComponent.seq) saveObj.seq = createComponent.seq;
            if (createComponent.useYn) saveObj.useYn = createComponent.useYn;
            if (createComponent.icon) saveObj.icon = createComponent.icon;
            if (createComponent.description) saveObj.description = createComponent.description;

            return await this.componentRepository.save(saveObj);
        }
    }

    async findAll() {
        const components = await this.componentRepository.find({where: {useYn: YesNo.YES}})
        components.forEach((component, index) => {
            component.option = JSON.parse(component.option);
        })

        return components;
    }

    async findOne(id: number) {
        const find_component_one = await this.componentRepository.findOne({where: {id: id}})
        return find_component_one;
    }

    async update(id: number, body: any) {

        const find_component = await this.componentRepository.findOne({where: {id: id}})
        if (!find_component) {
            return 'No exist type'
        } else {
            find_component.type = body.type;
            find_component.title = body.title;
            find_component.description = body.description;
            find_component.category = body.category;
            find_component.option = JSON.stringify(body.option);
            find_component.icon = body.icon;
            find_component.seq = body.seq;
            find_component.useYn = body.useYn;

            await this.componentRepository.save(find_component)

            return 'Success update'
        }


    }

    async remove(id: number) {
        await this.componentRepository.delete({id})
        return `This action removes a #${id} component`;
    }
}
