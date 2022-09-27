import {Injectable} from '@nestjs/common';
import {CreateTemplateDto} from './dto/create-template.dto';
import {UpdateTemplateDto} from './dto/update-template.dto';
import {InjectRepository} from "@nestjs/typeorm";
import {Template} from "./entities/template.entity";
import {Repository} from "typeorm";
import {YesNo} from "../common/enum/yn.enum";
import {TemplateItem} from "./entities/template-item.entity";
import {CreateTemplateItemDto} from "./dto/create-template-item.dto";
import {UpdateTemplateItemDto} from "./dto/update-template-item.dto";

@Injectable()
export class TemplateService {
    constructor(
        @InjectRepository(Template)
        private readonly templateRepository: Repository<Template>,
        @InjectRepository(TemplateItem)
        private readonly templateItemRepository: Repository<TemplateItem>
    ) {
    }

    /**
     * 템플릿 추가
     * @param createTemplate
     */
    async create(createTemplate: CreateTemplateDto) {
        const insertItem = await this.templateRepository.save({
            title: createTemplate.title,
            description: createTemplate.description,
            layout: createTemplate.layout,
        })
        return insertItem;
    }

    /**
     * 템플릿 상세 아이템 추가
     * @param CreateTemplateItemDto
     */
    async createItem(createTemplateItem: CreateTemplateItemDto) {
        const insertItem = await this.templateItemRepository.save({
            templateId: createTemplateItem.templateId,
            x: createTemplateItem.x,
            y: createTemplateItem.y,
            width: createTemplateItem.width,
            height: createTemplateItem.height,
            recommendCategory: createTemplateItem.recommendCategory,
        })
        return insertItem;
    }

    /**
     * 템플릿 목록 조회
     */
    findAll() {
        return this.templateRepository.find({
            select: {
                id: true,
                title: true,
                description: true,
                // layout: true
            },
            where: {
                useYn: YesNo.YES
            }
        });
    }

    /**
     * 템플릿 단건 조회
     * @param id
     */
    findOne(id: number) {
        return this.templateRepository.findOne({
            select: {
                id: true,
                title: true,
                description: true,
                // layout: true
            },
            where: {
                useYn: YesNo.YES,
                id: id,
            }
        });
    }

    /**
     * 템플릿 업데이트
     * @param id
     * @param updateTemplateDto
     */
    async update(id: number, updateTemplateDto: UpdateTemplateDto) {

        const updateItem = await this.templateRepository.update({
            id: id
        }, {
            title: updateTemplateDto.title,
            description: updateTemplateDto.description,
            // layout: updateTemplateDto.layout
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

    /**
     * 템플릿 상세 아이템 추가
     * @param id
     * @param updateTemplateItem
     */
    async updateItem(id: number,updateTemplateItem: UpdateTemplateItemDto) {
        const updateItem = await this.templateItemRepository.update({
            id: id
        }, {
            x: updateTemplateItem.x,
            y: updateTemplateItem.y,
            width: updateTemplateItem.width,
            height: updateTemplateItem.height,
            recommendCategory: updateTemplateItem.recommendCategory
        });
        console.log("update result", updateItem);

        let msg = `This action updates a #${id} templateItem`
        if (updateItem.affected < 1) {
            msg = '변동사항 없음';
        } else if (updateItem.affected > 1) {
            msg = '여러개 바뀜';
        }
        return msg;
    }

    /**
     * 템플릿 비활성화(useYn='Y')
     * @param id
     */
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
