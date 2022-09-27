import {Injectable} from '@nestjs/common';
import {CreateTemplateDto} from './dto/create-template.dto';
import {UpdateTemplateDto} from './dto/update-template.dto';
import {InjectRepository} from "@nestjs/typeorm";
import {Template} from "./entities/template.entity";
import {Repository} from "typeorm";
import {YesNo} from "../common/enum/yn.enum";

@Injectable()
export class TemplateService {
    constructor(
        @InjectRepository(Template)
        private readonly templateRepository: Repository<Template>
    ) {
    }

    async create(createTemplate: CreateTemplateDto) {
        const insertItem = await this.templateRepository.save({
            title: createTemplate.title,
            description: createTemplate.description,
            layout: createTemplate.layout,
        })
        return insertItem;
    }

    findAll() {
        return this.templateRepository.find({
            select: {
                id: true,
                title: true,
                description: true,
                layout: true
            },
            where: {
                useYn: YesNo.YES
            }
        });
    }

    findOne(id: number) {
        return this.templateRepository.findOne({
            select: {
                id: true,
                title: true,
                description: true,
                layout: true
            },
            where: {
                useYn: YesNo.YES,
                id: id,
            }
        });
    }

    async update(id: number, updateTemplateDto: UpdateTemplateDto) {
        const updateItem = await this.templateRepository.update({
            id: id
        }, {
            title: updateTemplateDto.title,
            description: updateTemplateDto.description,
            layout: updateTemplateDto.layout
        });
        console.log("update result", updateItem);

        let msg = `This action updates a #${id} template`
        if (updateItem.affected < 1) {
            msg = '변동사항 없음';
        } else if (updateItem.affected > 1) {
            msg = '여러개 바뀜';
        }
        return msg;
    }

    async remove(id: number) {
        const deleteItem = await this.templateRepository.update({
            id: id
        }, {
            useYn: YesNo.YES
        });

        let msg = `#${id} template useYn='Y' 변경완료 `
        if (deleteItem.affected < 1) {
            msg = '변동사항 없음';
        } else if (deleteItem.affected > 1) {
            msg = '여러개 바뀜';
        }
        return msg;
    }

    /**
     * 선택된 위젯목록으로 추천될 template 목록
     * @param widgets
     */
    findRecommendTemplates(widgets: any[]) {

    }
}
