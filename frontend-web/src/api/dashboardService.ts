import { del, get, post, put } from '@/helpers/apiHelper';

export const URL_DASHBOARD = '/dashboard';

const selectDashboardList = (): Promise<any> => get(URL_DASHBOARD);
const selectDashboard = (id: string): Promise<any> => get(URL_DASHBOARD + '/' + id);
const createDashboard = (data: unknown): Promise<any> => post(URL_DASHBOARD, data);
const updateDashboard = (id: string, data: unknown): Promise<any> => put(URL_DASHBOARD + '/' + id, data);
const deleteDashboard = (id: string): Promise<any> => del(URL_DASHBOARD + '/' + id);

const DashboardService = {
  selectDashboardList,
  selectDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
};

export default DashboardService;
