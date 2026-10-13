import { SourceAccessService } from '../ownership/source-access.service';
import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AnalysisUpload } from '../analysis/duckdb.service';
import {
  Body,
  Headers,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { QueryExecuteDto } from './dto/query-execute.dto';
import { ConnectionService } from '../connection/connection.service';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@UseGuards(JwtAuthGuard, SourceOwnershipGuard)
@Controller('database')
@ApiTags('dashboard')
export class DatabaseController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly connectionService: ConnectionService,
    private readonly access: SourceAccessService,
  ) {}

  /**
   * database type 목록 조회
   */
  @Get('/type')
  findTypeList() {
    return this.databaseService.findTypeList();
  }
  @Get('/data')
  async findData(
    @Query('datasetType') datasetType: DatasetType,
    @Query('databaseId') databaseId: number,
    @Query('datasetId') datasetId?: number,
    @Query('tableName') tableName?: string,
    @Headers('x-socket-id') socketId?: string,
  ) {
    const res = await this.databaseService.findData(
      datasetType,
      databaseId,
      datasetId,
      tableName,
      socketId,
    );
    return res;
  }

  /**
   * 데이터베이스 연결정보 단순조회
   * @param id
   */
  @Get('/info/:id')
  async findOneInfo(@Param('id') id: string) {
    const databaseInfo = await this.databaseService.findOneInfo(+id);
    return databaseInfo;
  }

  /**
   * 데이터베이스 생성 ( 데이터소스 생성)
   * @param createDatabaseDto
   */
  @Post()
  create(@Body() createDatabaseDto: CreateDatabaseDto, @Req() req) {
    return this.databaseService.create(
      createDatabaseDto,
      this.access.actor(req.user.accessKeyData.id),
    );
  }

  /**
   * 파일 업로드 → 서버 워커에서 DuckDB 데이터소스 생성
   * @param file
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const directory = path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads', 'incoming');
          fs.mkdir(directory, { recursive: true, mode: 0o700 }, error =>
            callback(error, directory),
          );
        },
        filename: (_request, _file, callback) => callback(null, randomUUID()),
      }),
      limits: {
        fileSize: Number(process.env.FILE_UPLOAD_MAX_BYTES) || 512 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  uploadFile(@UploadedFile() file: AnalysisUpload, @Req() req) {
    return this.databaseService.uploadFile(file, this.access.actor(req.user.accessKeyData.id));
  }

  @Get(':id/file-versions')
  fileVersions(@Param('id') id: string, @Req() req) {
    return this.databaseService.fileVersions(+id, this.access.actor(req.user.accessKeyData.id));
  }

  @Post(':id/file-replacement')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const directory = path.resolve(process.env.FILE_UPLOAD_DIR || 'uploads', 'incoming');
          fs.mkdir(directory, { recursive: true, mode: 0o700 }, error =>
            callback(error, directory),
          );
        },
        filename: (_request, _file, callback) => callback(null, randomUUID()),
      }),
      limits: {
        fileSize: Number(process.env.FILE_UPLOAD_MAX_BYTES) || 512 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  replaceFile(
    @Param('id') id: string,
    @UploadedFile() file: AnalysisUpload,
    @Body('expectedRevision') expectedRevision: string,
    @Req() req,
  ) {
    return this.databaseService.replaceFile(
      +id,
      file,
      expectedRevision,
      this.access.actor(req.user.accessKeyData.id),
    );
  }

  @Post(':id/file-restore')
  restoreFile(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.databaseService.restoreFile(
      +id,
      body,
      this.access.actor(req.user.accessKeyData.id),
    );
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  @Post('test')
  testConnection(@Body() createDatabaseDto: CreateDatabaseDto) {
    return this.connectionService.testConnection(createDatabaseDto);
  }

  /**
   * 쿼리 실행
   * @param queryExecuteDto
   */
  @Post('execute')
  executeQuery(
    @Body() queryExecuteDto: QueryExecuteDto,
    @Headers('x-socket-id') socketId?: string,
  ) {
    return this.connectionService.executeQuery(queryExecuteDto, socketId);
  }

  /**
   * 데이터베이스 목록 조회
   */
  @Get()
  async findAll(@Req() req) {
    const res = await this.databaseService.findAll();
    return this.access.filterResults('database', req.user.accessKeyData.id, res);
  }

  /**
   * 데이터베이스 상세 조회 - 데이터베이스 연결정보, 테이블, 데이터셋 조회
   * @param id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const databaseInfo = await this.databaseService.findOne(+id);
    return databaseInfo;
  }

  /**
   * database update
   * @param id
   * @param updateDatabaseDto
   */
  @Put(':id')
  update(@Param('id') id: string, @Body() updateDatabaseDto: UpdateDatabaseDto) {
    return this.databaseService.update(+id, updateDatabaseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.databaseService.remove(+id);
  }
}
