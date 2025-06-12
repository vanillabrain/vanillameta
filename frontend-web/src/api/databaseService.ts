import { del, get, post, put } from '@/helpers/apiHelper';
import { 
  ApiResponse, 
  CreateDatabaseRequest,
  UpdateDatabaseRequest,
  TestConnectionRequest,
  QueryExecuteRequest,
  DatabaseListResponse,
  DatabaseDetailResponse,
  DatabaseTypeListResponse,
  ConnectionTestResponse,
  QueryExecuteResponse,
  Database,
  DatabaseType
} from '@/types';

export const URL_DATABASE = '/database';

const selectDatabaseList = (): Promise<ApiResponse<Database[]>> => 
  get(URL_DATABASE);

const selectDatabaseInfo = (id: string, data = null): Promise<ApiResponse<Database>> => 
  get(URL_DATABASE + '/info/' + id, data);

const selectDatabase = (id: string, data = null): Promise<ApiResponse<DatabaseDetailResponse>> => 
  get(URL_DATABASE + '/' + id, data);

const testConnection = (data: TestConnectionRequest): Promise<ApiResponse<ConnectionTestResponse>> => 
  post(URL_DATABASE + '/test', data);

const executeQuery = (data: QueryExecuteRequest): Promise<ApiResponse<QueryExecuteResponse>> => 
  post(URL_DATABASE + '/execute', data);

const selectDatabaseTypeList = (): Promise<ApiResponse<DatabaseType[]>> => 
  get(URL_DATABASE + '/type');

const createDatabase = (data: CreateDatabaseRequest): Promise<ApiResponse<Database>> => 
  post(URL_DATABASE, data);

const updateDatabase = (id: string, data: UpdateDatabaseRequest): Promise<ApiResponse<Database>> => 
  put(URL_DATABASE + '/' + id, data);

const deleteDatabase = (id: string): Promise<ApiResponse<null>> => 
  del(URL_DATABASE + '/' + id);

const selectData = (data: QueryExecuteRequest): Promise<ApiResponse<QueryExecuteResponse>> => 
  get(URL_DATABASE + '/data', data);

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
