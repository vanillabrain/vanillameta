import { del, get, post, put } from '@/helpers/apiHelper';
import {
  ApiResponse,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  DashboardListResponse,
  DashboardDetailResponse,
  Dashboard,
} from '@/types';

export const URL_DASHBOARD = '/dashboard';

const selectDashboardList = (): Promise<ApiResponse<Dashboard[]>> => get(URL_DASHBOARD);

const selectDashboard = (id: string): Promise<ApiResponse<DashboardDetailResponse>> => get(URL_DASHBOARD + '/' + id);

const createDashboard = (data: CreateDashboardRequest): Promise<ApiResponse<Dashboard>> => post(URL_DASHBOARD, data);

const updateDashboard = (id: string, data: UpdateDashboardRequest): Promise<ApiResponse<Dashboard>> =>
  put(URL_DASHBOARD + '/' + id, data);

const deleteDashboard = (id: string): Promise<ApiResponse<null>> => del(URL_DASHBOARD + '/' + id);

const DashboardService = {
  selectDashboardList,
  selectDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
};

export default DashboardService;
