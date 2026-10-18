import { get, post, put } from '@/helpers/apiHelper';

import { submitDashboardDeletion } from '@/api/dashboardDeletionService';

export const URL_DASHBOARD = '/dashboard';

const selectDashboardList = (): Promise<any> => get(URL_DASHBOARD);
const selectDashboard = (id: string): Promise<any> => get(URL_DASHBOARD + '/' + id);
const createDashboard = (data: unknown): Promise<any> => post(URL_DASHBOARD, data);
const updateDashboard = (id: string, data: unknown): Promise<any> => put(URL_DASHBOARD + '/' + id, data);
// Deletion always requires the confirmed frozen body; there is no bodyless compatibility path.
const deleteDashboard = submitDashboardDeletion;

const DashboardService = {
  selectDashboardList,
  selectDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
};

export default DashboardService;
