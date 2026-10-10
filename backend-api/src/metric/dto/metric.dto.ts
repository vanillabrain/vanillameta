import { MetricAggregation } from '../entities/metric.entity';

export interface MetricFilter {
  column: string;
  op: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'IN';
  value: string | number | Array<string | number>;
}

export class CreateMetricDto {
  name: string;
  description?: string;
  databaseId: number;
  tableName: string;
  aggregation: MetricAggregation;
  expression: string;
  groupBy?: string;
  filters?: MetricFilter[];
}

export class UpdateMetricDto {
  name?: string;
  description?: string;
  databaseId?: number;
  tableName?: string;
  aggregation?: MetricAggregation;
  expression?: string;
  groupBy?: string;
  filters?: MetricFilter[];
}
