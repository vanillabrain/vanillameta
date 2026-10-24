import { FileRefresh } from './entities/file-refresh.entity';
import { FileRefreshService } from './file-refresh.service';
import { FileRefreshController, FileRefreshOwnerGuard } from './file-refresh.controller';
import { SourceDeletionService } from './source-deletion.service';
import { UserStorageService } from './user-storage.service';
import { SourceDeletionController } from './source-deletion.controller';
import { SourceDeleteReceipt } from './entities/source-delete-receipt.entity';
import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { ConnectionModule } from '../connection/connection.module';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { DatabaseType } from './entities/database_type.entity';
import { JwtService } from '@nestjs/jwt';
import { SqlValidationModule } from '../common/security/sql-validation.module';
// import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConnectionModule,
    SqlValidationModule,
    TypeOrmModule.forFeature([
      Database,
      Dataset,
      TableQuery,
      DatabaseType,
      FileRefresh,
      SourceDeleteReceipt,
    ]),
  ],
  controllers: [SourceDeletionController, DatabaseController, FileRefreshController],
  providers: [
    SourceDeletionService,
    FileRefreshService,
    FileRefreshOwnerGuard,
    DatabaseService,
    UserStorageService,
    JwtService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
