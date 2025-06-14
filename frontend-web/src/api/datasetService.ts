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

const selectDatasetList = (): Promise<ApiResponse<Dataset[]>> => get(SERVICE_URL);

const selectDataset = (id: string, data = null): Promise<ApiResponse<DatasetDetailResponse>> =>
  get(SERVICE_URL + '/' + id, data);

const createDataset = (data: CreateDatasetRequest): Promise<ApiResponse<Dataset>> => post(SERVICE_URL, data);

const updateDataset = (id: string, data: UpdateDatasetRequest): Promise<ApiResponse<Dataset>> =>
  put(SERVICE_URL + '/' + id, data);

const deleteDataset = (id: string): Promise<ApiResponse<null>> => del(SERVICE_URL + '/' + id);

const DatasetService = {
  selectDatasetList,
  selectDataset,
  createDataset,
  updateDataset,
  deleteDataset,
};

export default DatasetService;
