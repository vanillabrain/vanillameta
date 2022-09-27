import {Template} from "../entities/template.entity";
import {ItemInfoDto} from "./item-info.dto";

export class TemplateInfoDto {
    id: number;
    title: string;
    description: string;
    layout: ItemInfoDto[];

    constructor(template: Template) {
        this.id = template.id;
        this.title = template.title;
        this.description = template.description;
    };
}
