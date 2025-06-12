import { del, get, post, put } from '@/helpers/apiHelper';
import { 
  ApiResponse, 
  CreateComponentRequest,
  UpdateComponentRequest,
  ComponentListResponse,
  ComponentDetailResponse,
  Component
} from '@/types';

export const URL_COMPONENT = '/component';

const selectComponentList = (): Promise<ApiResponse<Component[]>> => 
  get(URL_COMPONENT);

const selectComponent = (id: string, data: any = null): Promise<ApiResponse<ComponentDetailResponse>> => 
  get(URL_COMPONENT + '/' + id, data);

const createComponent = (data: CreateComponentRequest): Promise<ApiResponse<Component>> => 
  post(URL_COMPONENT, data);

const updateComponent = (data: UpdateComponentRequest): Promise<ApiResponse<Component>> => 
  put(URL_COMPONENT, data);

const deleteComponent = (data: { id: number }): Promise<ApiResponse<null>> => 
  del(URL_COMPONENT, data);

const ComponentService = {
  selectComponentList,
  selectComponent,
  createComponent,
  updateComponent,
  deleteComponent,
};

export default ComponentService;
