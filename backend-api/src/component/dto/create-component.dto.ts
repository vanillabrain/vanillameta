import {IsNotEmpty, IsNumber, IsOptional, IsString} from "class-validator";
import {YesNo} from "../../common/enum/yn.enum";

export class CreateComponentDto {
    @IsString()
    @IsNotEmpty()
    type: string;

    @IsString()
    title: string;

    @IsString()
    @IsOptional()
    description: string;

    @IsString()
    @IsNotEmpty()
    category: string

    @IsString()
    @IsNotEmpty()
    option: string

    @IsString()
    @IsOptional()
    icon: string

    @IsNumber()
    @IsOptional()
    seq: number

    @IsString()
    @IsOptional()
    useYn: string

}