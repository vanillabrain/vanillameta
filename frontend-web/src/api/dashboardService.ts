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

const selectDashboardList = (): Promise<ApiResponse<Dashboard[]>> => get<ApiResponse<Dashboard[]>>(URL_DASHBOARD);

const selectDashboard = (id: string): Promise<ApiResponse<DashboardDetailResponse>> =>
  get<ApiResponse<DashboardDetailResponse>>(URL_DASHBOARD + '/' + id);

const createDashboard = (data: CreateDashboardRequest): Promise<ApiResponse<Dashboard>> =>
  post<ApiResponse<Dashboard>>(URL_DASHBOARD, data);

const updateDashboard = (id: string, data: UpdateDashboardRequest): Promise<ApiResponse<Dashboard>> =>
  put<ApiResponse<Dashboard>>(URL_DASHBOARD + '/' + id, data);

const deleteDashboard = (id: string): Promise<ApiResponse<null>> => del<ApiResponse<null>>(URL_DASHBOARD + '/' + id);

const DashboardService = {
  selectDashboardList,
  selectDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
};

export default DashboardService;
