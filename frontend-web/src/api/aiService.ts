import { post } from '@/helpers/apiHelper';

export const URL_AI = '/ai';

const generateSql = (data: { databaseId: string | number; prompt: string }): Promise<any> =>
  post(URL_AI + '/text-to-sql', data);

const recommendChart = (data: {
  databaseId: string | number;
  datasetType: 'TABLE' | 'DATASET';
  tableName?: string;
  datasetId?: number;
}): Promise<any> => post(URL_AI + '/recommend-chart', data);

const dashboardInsight = (dashboardId: string | number): Promise<any> => post(URL_AI + '/dashboard-insight/' + dashboardId);

const AiService = {
  generateSql,
  recommendChart,
  dashboardInsight,
};

export default AiService;
