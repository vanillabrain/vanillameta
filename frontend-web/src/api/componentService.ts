import { del, get, post, put } from '@/helpers/apiHelper';
import {
  ApiResponse,
  CreateComponentRequest,
  UpdateComponentRequest,
  ComponentListResponse,
  ComponentDetailResponse,
  Component,
} from '@/types';

export const URL_COMPONENT = '/component';

const selectComponentList = (): Promise<ApiResponse<Component[]>> => get<ApiResponse<Component[]>>(URL_COMPONENT);

const selectComponent = (id: string, data: any = null): Promise<ApiResponse<ComponentDetailResponse>> =>
  get<ApiResponse<ComponentDetailResponse>>(URL_COMPONENT + '/' + id, data);

const createComponent = (data: CreateComponentRequest): Promise<ApiResponse<Component>> =>
  post<ApiResponse<Component>>(URL_COMPONENT, data);

const updateComponent = (data: UpdateComponentRequest): Promise<ApiResponse<Component>> =>
  put<ApiResponse<Component>>(URL_COMPONENT, data);

const deleteComponent = (data: { id: number }): Promise<ApiResponse<null>> => del<ApiResponse<null>>(URL_COMPONENT, data);

const ComponentService = {
  selectComponentList,
  selectComponent,
  createComponent,
  updateComponent,
  deleteComponent,
};

export default ComponentService;
