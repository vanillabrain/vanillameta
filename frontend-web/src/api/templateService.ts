import { get } from '@/helpers/apiHelper';

export const URL_TEMPLATE = '/template';

const selectTemplateList = (): Promise<any> => get(URL_TEMPLATE);

const dashboardService = {
  selectTemplateList,
};

export default dashboardService;
