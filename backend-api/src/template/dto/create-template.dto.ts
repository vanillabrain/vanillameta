import {IsOptional, IsString} from "class-validator";
import {ItemInfoDto} from "./item-info.dto";

export class CreateTemplateDto {
    @IsString()
    readonly title: string;
    @IsString()
    @IsOptional()
    readonly description: string;
    readonly layout: ItemInfoDto[];
}
