import {IsNotEmpty, IsNumber, IsString} from "class-validator";
import {DatasetType} from "../../common/enum/dataset-type.enum";
import {YesNo} from "../../common/enum/yn.enum";

export class CreateWidgetDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    description: string;

    @IsNumber()
    @IsNotEmpty()
    componentId: number;

    @IsString()
    @IsNotEmpty()
    datasetType: DatasetType

    @IsNumber()
    @IsNotEmpty()
    datasetId: number

    @IsString()
    @IsNotEmpty()
    option: string

    @IsString()
    delYn: YesNo

    @IsNumber()
    widgetViewId: number
}