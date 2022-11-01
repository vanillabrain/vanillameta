import { del, get, post, put } from '@/helpers/apiHelper';

export const SERVICE_URL = '/dataset';

const selectDatasetList = (): Promise<any> => get(SERVICE_URL);
const selectDataset = (id: string, data = null): Promise<any> => get(SERVICE_URL + '/' + id, data);
const createDataset = (data: unknown): Promise<any> => post(SERVICE_URL, data);
const updateDataset = (id: string, data: unknown): Promise<any> => put(SERVICE_URL + '/' + id, data);
const deleteDataset = (id: string): Promise<any> => del(SERVICE_URL + '/' + id);

const DatasetService = {
  selectDatasetList,
  selectDataset,
  createDataset,
  updateDataset,
  deleteDataset,
};

export default DatasetService;
