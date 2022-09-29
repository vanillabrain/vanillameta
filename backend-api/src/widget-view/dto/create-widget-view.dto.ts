
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { DatasetType } from '../../common/enum/dataset-type.enum';
import { YesNo } from '../../common/enum/yn.enum';

export class CreateWidgetViewDto {
    @IsNumber()
    @IsNotEmpty()
    databaseId: number;

    @IsString()
    @IsOptional()
    query: string;

}
