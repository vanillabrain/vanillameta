import { submitMetricDeletion } from '@/api/metricDeletionService';
import { get, post, put } from '@/helpers/apiHelper';

export const URL_METRIC = '/metric';

export interface MetricFilter {
  column: string;
  op: string;
  value: unknown;
}

export interface MetricDefinition {
  id?: number;
  name: string;
  description?: string;
  databaseId: number;
  tableName: string;
  aggregation: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'COUNT_DISTINCT';
  expression: string;
  groupBy?: string;
  filters?: MetricFilter[];
}

const selectMetrics = (): Promise<any> => get(URL_METRIC);
const createMetric = (data: MetricDefinition): Promise<any> => post(URL_METRIC, data);
const updateMetric = (id: number, data: Partial<MetricDefinition>): Promise<any> => put(`${URL_METRIC}/${id}`, data);
const deleteMetric = submitMetricDeletion;
const evaluateMetric = (id: number): Promise<any> => post(`${URL_METRIC}/${id}/evaluate`);

const MetricService = {
  selectMetrics,
  createMetric,
  updateMetric,
  deleteMetric,
  evaluateMetric,
};

export default MetricService;
