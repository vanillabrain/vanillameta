import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { DatasetType } from '../../common/enum/dataset-type.enum';
import { YesNo } from '../../common/enum/yn.enum';

export class CreateWidgetDto {
  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsNumber()
  @IsOptional()
  databaseId: number;

  @IsNumber()
  @IsNotEmpty()
  componentId: number;

  @IsString()
  @IsNotEmpty()
  datasetType: DatasetType;

  @IsNumber()
  @IsNotEmpty()
  datasetId: number;

  @IsString()
  @IsOptional()
  tableName: string;

  @IsString()
  @IsNotEmpty()
  option: string;

  @IsString()
  @IsOptional()
  delYn: YesNo;
}
