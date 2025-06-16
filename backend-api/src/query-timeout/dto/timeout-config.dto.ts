import {
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum QueryComplexity {
  SIMPLE = 'simple',
  MEDIUM = 'medium',
  COMPLEX = 'complex',
  BATCH = 'batch',
}

export enum DatabaseEngine {
  MYSQL = 'mysql2',
  POSTGRESQL = 'pg',
  SQLITE = 'sqlite3',
  MSSQL = 'mssql',
  ORACLE = 'oracledb',
  BIGQUERY = 'bigquery',
  SNOWFLAKE = 'snowflake',
  COCKROACHDB = 'cockroachdb',
}

export class TimeoutConfigDto {
  @IsEnum(DatabaseEngine)
  engine: DatabaseEngine;

  @IsEnum(QueryComplexity)
  complexity: QueryComplexity;

  @IsNumber()
  @Min(1000)
  @Max(300000)
  @Type(() => Number)
  timeoutMs: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;
}

export class AdaptiveTimeoutConfigDto {
  @IsNumber()
  @Type(() => Number)
  databaseId: number;

  @IsString()
  query: string;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  @Type(() => Number)
  requestedTimeoutMs?: number;

  @IsOptional()
  @IsBoolean()
  enableAdaptive?: boolean = true;

  @IsOptional()
  @IsArray()
  historicalExecutionTimes?: number[];
}

export class TimeoutUpdateDto {
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  @Type(() => Number)
  defaultTimeoutMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(600000)
  @Type(() => Number)
  batchTimeoutMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1.1)
  @Max(5.0)
  @Type(() => Number)
  complexityMultiplier?: number;

  @IsOptional()
  @IsBoolean()
  enableAdaptiveTimeout?: boolean;

  @IsOptional()
  @IsBoolean()
  enableTimeoutMonitoring?: boolean;
}

export interface TimeoutRule {
  engine: DatabaseEngine;
  complexity: QueryComplexity;
  baseTimeoutMs: number;
  maxTimeoutMs: number;
  adaptiveMultiplier: number;
  description: string;
}
