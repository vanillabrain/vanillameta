import { del, get, post, put } from '@/helpers/apiHelper';
import { ApiResponse, CreateWidgetRequest, UpdateWidgetRequest, WidgetDetailResponse, Widget } from '@/types';

export const URL_WIDGET = '/widget';

const selectWidgetList = (): Promise<ApiResponse<Widget[]>> => get<ApiResponse<Widget[]>>(URL_WIDGET);

const selectWidget = (id: string, data = null): Promise<ApiResponse<WidgetDetailResponse>> =>
  get<ApiResponse<WidgetDetailResponse>>(URL_WIDGET + '/' + id, data);

const createWidget = (data: CreateWidgetRequest): Promise<ApiResponse<Widget>> =>
  post<ApiResponse<Widget>>(URL_WIDGET, data);

const updateWidget = (id: string, data: UpdateWidgetRequest): Promise<ApiResponse<Widget>> =>
  put<ApiResponse<Widget>>(URL_WIDGET + '/' + id, data);

const deleteWidget = (id: string): Promise<ApiResponse<null>> => del<ApiResponse<null>>(URL_WIDGET + '/' + id);

const WidgetService = {
  selectWidgetList,
  selectWidget,
  createWidget,
  updateWidget,
  deleteWidget,
};

export default WidgetService;
