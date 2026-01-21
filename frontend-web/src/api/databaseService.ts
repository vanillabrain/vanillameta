import { del, get, post, put } from '@/helpers/apiHelper';
import {
  ApiResponse,
  CreateDatabaseRequest,
  UpdateDatabaseRequest,
  TestConnectionRequest,
  QueryExecuteRequest,
  DatabaseDetailResponse,
  ConnectionTestResponse,
  QueryExecuteResponse,
  Database,
  DatabaseType,
} from '@/types';

export const URL_DATABASE = '/database';

const selectDatabaseList = (): Promise<ApiResponse<Database[]>> => get<ApiResponse<Database[]>>(URL_DATABASE);

const selectDatabaseInfo = (id: string, data = null): Promise<ApiResponse<Database>> =>
  get<ApiResponse<Database>>(URL_DATABASE + '/info/' + id, data);

const selectDatabase = (id: string, data = null): Promise<ApiResponse<DatabaseDetailResponse>> =>
  get<ApiResponse<DatabaseDetailResponse>>(URL_DATABASE + '/' + id, data);

const testConnection = (data: TestConnectionRequest): Promise<ApiResponse<ConnectionTestResponse>> =>
  post<ApiResponse<ConnectionTestResponse>>(URL_DATABASE + '/test', data);

const executeQuery = (data: QueryExecuteRequest): Promise<ApiResponse<QueryExecuteResponse>> =>
  post<ApiResponse<QueryExecuteResponse>>(URL_DATABASE + '/execute', data);

const selectDatabaseTypeList = (): Promise<ApiResponse<DatabaseType[]>> =>
  get<ApiResponse<DatabaseType[]>>(URL_DATABASE + '/type');

const createDatabase = (data: CreateDatabaseRequest): Promise<ApiResponse<Database>> =>
  post<ApiResponse<Database>>(URL_DATABASE, data);

const updateDatabase = (id: string, data: UpdateDatabaseRequest): Promise<ApiResponse<Database>> =>
  put<ApiResponse<Database>>(URL_DATABASE + '/' + id, data);

const deleteDatabase = (id: string): Promise<ApiResponse<null>> => del<ApiResponse<null>>(URL_DATABASE + '/' + id);

const selectData = (data: QueryExecuteRequest): Promise<ApiResponse<QueryExecuteResponse>> =>
  get<ApiResponse<QueryExecuteResponse>>(URL_DATABASE + '/data', data);

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
