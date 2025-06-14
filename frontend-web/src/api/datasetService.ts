import { del, get, post, put } from '@/helpers/apiHelper';
import {
  ApiResponse,
  CreateDatasetRequest,
  UpdateDatasetRequest,
  DatasetListResponse,
  DatasetDetailResponse,
  Dataset,
} from '@/types';

export const SERVICE_URL = '/dataset';

const selectDatasetList = (): Promise<ApiResponse<Dataset[]>> => get<ApiResponse<Dataset[]>>(SERVICE_URL);

const selectDataset = (id: string, data = null): Promise<ApiResponse<DatasetDetailResponse>> =>
  get<ApiResponse<DatasetDetailResponse>>(SERVICE_URL + '/' + id, data);

const createDataset = (data: CreateDatasetRequest): Promise<ApiResponse<Dataset>> =>
  post<ApiResponse<Dataset>>(SERVICE_URL, data);

const updateDataset = (id: string, data: UpdateDatasetRequest): Promise<ApiResponse<Dataset>> =>
  put<ApiResponse<Dataset>>(SERVICE_URL + '/' + id, data);

const deleteDataset = (id: string): Promise<ApiResponse<null>> => del<ApiResponse<null>>(SERVICE_URL + '/' + id);

const DatasetService = {
  selectDatasetList,
  selectDataset,
  createDataset,
  updateDataset,
  deleteDataset,
};

export default DatasetService;
