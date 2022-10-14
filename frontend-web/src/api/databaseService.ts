import { del, get, post, put } from '@/helpers/apiHelper';

export const URL_WIDGET = '/database';

const selectDatabaseList = (): Promise<any> => get(URL_WIDGET);
const selectDatabase = (id: string, data = null): Promise<any> => get(URL_WIDGET + '/' + id, data);
const testConnection = (data: unknown): Promise<any> => post(URL_WIDGET + '/test', data);
const executeQuery = (data: unknown): Promise<any> => post(URL_WIDGET + '/execute', data);
const createDatabase = (data: unknown): Promise<any> => post(URL_WIDGET, data);
const updateDatabase = (id: string, data: unknown): Promise<any> => put(URL_WIDGET + '/' + id, data);
const deleteDatabase = (id: string): Promise<any> => del(URL_WIDGET + '/' + id);

const DatabaseService = {
  selectDatabaseList,
  selectDatabase,
  createDatabase,
  updateDatabase,
  deleteDatabase,
};

export default DatabaseService;
