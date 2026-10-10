import { DatasetType } from '../../common/enum/dataset-type.enum';

export class RecommendChartDto {
  databaseId: number;
  datasetType: DatasetType;
  tableName?: string;
  datasetId?: number;
}
