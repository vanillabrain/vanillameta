import { IsDefined, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
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

  // 위젯 옵션은 자유 형식(객체)이며 서비스에서 JSON.stringify 하여 저장한다.
  @IsDefined()
  option: any;

  @IsString()
  @IsOptional()
  delYn: string;
}
