import { del, get, post, postForm, put } from '@/helpers/apiHelper';

export const URL_DATABASE = '/database';

const selectDatabaseList = (): Promise<any> => get(URL_DATABASE);
const selectDatabaseInfo = (id: string | number, data = null): Promise<any> => get(URL_DATABASE + '/info/' + id, data);
const selectDatabase = (id: string | number, data = null): Promise<any> => get(URL_DATABASE + '/' + id, data);
const testConnection = (data: unknown): Promise<any> => post(URL_DATABASE + '/test', data);
const executeQuery = (data: unknown): Promise<any> => post(URL_DATABASE + '/execute', data);
const selectDatabaseTypeList = (): Promise<any> => get(URL_DATABASE + '/type');
const createDatabase = (data: unknown): Promise<any> => post(URL_DATABASE, data);
const updateDatabase = (id: string | number, data: unknown): Promise<any> => put(URL_DATABASE + '/' + id, data);
const deleteDatabase = (id: string | number): Promise<any> => del(URL_DATABASE + '/' + id);
const selectData = (data: unknown): Promise<any> => get(URL_DATABASE + '/data', data);
const uploadFile = (file: File): Promise<any> => {
  const form = new FormData();
  form.append('file', file);
  return postForm(URL_DATABASE + '/upload', form);
};

const DatabaseService = {
  selectDatabaseList,
  selectDatabaseInfo,
  selectDatabase,
  selectDatabaseTypeList,
  createDatabase,
  updateDatabase,
  deleteDatabase,
  testConnection,
  executeQuery,
  selectData,
  uploadFile,
};

export default DatabaseService;
