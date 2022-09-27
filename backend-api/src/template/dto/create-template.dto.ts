import {IsOptional, IsString} from "class-validator";

export class CreateTemplateDto {
    @IsString()
    readonly title: string;
    @IsString()
    @IsOptional()
    readonly description: string;
}
