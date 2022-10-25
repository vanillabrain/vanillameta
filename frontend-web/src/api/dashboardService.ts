import { del, get, post, put } from '@/helpers/apiHelper';

export const URL_DASHBOARD = '/dashboard';

const selectDashboardList = (): Promise<any> => get(URL_DASHBOARD);
const selectDashboard = (id: string, data): Promise<any> => get(URL_DASHBOARD + '/' + id, data);
const createDashboard = (data: unknown): Promise<any> => post(URL_DASHBOARD, data);
const updateDashboard = (data: unknown): Promise<any> => put(URL_DASHBOARD, data);
const deleteDashboard = (data: unknown): Promise<any> => del(URL_DASHBOARD, data);

const dashboardService = {
  selectDashboardList,
  selectDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
};

export default dashboardService;
