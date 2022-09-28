import {IsNotEmpty, IsNumber, IsString} from "class-validator";
import {YesNo} from "../../common/enum/yn.enum";

export class CreateComponentDto {
    @IsString()
    @IsNotEmpty()
    type: string;

    @IsString()
    title: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsString()
    @IsNotEmpty()
    category: string

    @IsString()
    @IsNotEmpty()
    option: string

    @IsString()
    @IsNotEmpty()
    icon: string

    @IsNumber()
    @IsNotEmpty()
    seq: number

    @IsString()
    useYn: YesNo

}