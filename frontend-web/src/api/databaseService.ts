import { del, get, post, put } from '@/helpers/apiHelper';

export const URL_DATABASE = '/database';

const selectDatabaseList = (): Promise<any> => get(URL_DATABASE);
const selectDatabaseInfo = (id: string, data = null): Promise<any> => get(URL_DATABASE + '/info/' + id, data);
const selectDatabase = (id: string, data = null): Promise<any> => get(URL_DATABASE + '/' + id, data);
const testConnection = (data: unknown): Promise<any> => post(URL_DATABASE + '/test', data);
const executeQuery = (data: unknown): Promise<any> => post(URL_DATABASE + '/execute', data);
const selectDatabaseTypeList = (): Promise<any> => get(URL_DATABASE + '/type');
const createDatabase = (data: unknown): Promise<any> => post(URL_DATABASE, data);
const updateDatabase = (id: string, data: unknown): Promise<any> => put(URL_DATABASE + '/' + id, data);
const deleteDatabase = (id: string): Promise<any> => del(URL_DATABASE + '/' + id);
const selectData = (data: unknown): Promise<any> => get(URL_DATABASE + '/data', data);

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
};

export default DatabaseService;
