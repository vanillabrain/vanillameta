import {IsDefined, IsNotEmpty, IsNumber, IsOptional, IsString} from "class-validator";
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

    // 컴포넌트 옵션은 자유 형식(객체)이며 서비스에서 JSON.stringify 하여 저장한다.
    @IsDefined()
    option: any

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