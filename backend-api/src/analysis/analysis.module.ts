import { Global, Module } from '@nestjs/common';
import { DuckDBService } from './duckdb.service';

@Global()
@Module({ providers: [DuckDBService], exports: [DuckDBService] })
export class AnalysisModule {}
