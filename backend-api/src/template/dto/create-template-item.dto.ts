import {IsNumber, IsOptional, IsString} from "class-validator";

export class CreateTemplateItemDto {
    @IsNumber()
    readonly templateId: number;
    @IsNumber()
    readonly x: number;
    @IsNumber()
    readonly y: number;
    @IsNumber()
    readonly width: number;
    @IsNumber()
    readonly height: number;
    @IsString()
    @IsOptional()
    readonly recommendCategory: string;
    @IsString()
    @IsOptional()
    readonly recommendType: string;
}
