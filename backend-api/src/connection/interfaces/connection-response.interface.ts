import { ResponseStatus } from '../../common/enum/response-status.enum';

export interface FieldInfo {
  columnName: string;
  columnType: string;
}

export interface QueryResult {
  status: ResponseStatus;
  message: string | null;
  datas: any[];
  fields: FieldInfo[];
}

export interface ConnectionTestResult {
  status: ResponseStatus;
  message?: string;
  data?: { message: string };
}

export interface DatabaseEngine {
  name: string;
  client: any; // Knex client type
}

export type SupportedEngine =
  | 'mysql'
  | 'mariadb'
  | 'pg'
  | 'postgres'
  | 'postgresql'
  | 'oracle'
  | 'oracledb'
  | 'cockroachdb'
  | 'redshift'
  | 'bigquery'
  | 'sqlite'
  | 'sqlite3'
  | 'mssql'
  | 'snowflake';
