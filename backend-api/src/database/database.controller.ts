import {
  FieldSelection,
  PredefinedFields,
} from '../common/field-selection/field-selection.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Response } from 'express';
import { Header, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
} from '@nestjs/swagger';
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
  Get,
  Param,
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
import { Utf8FileInterceptor } from './multipart-options';

@UseGuards(JwtAuthGuard, SourceOwnershipGuard)
@Controller('database')
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
  @ApiOperation({
    summary: '데이터베이스 타입 목록 조회',
    description: '지원하는 데이터베이스 타입의 목록을 조회합니다.',
  })
  @ApiOkResponse({
    description: '데이터베이스 타입 목록',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string', example: 'postgresql' },
          label: { type: 'string', example: 'PostgreSQL' },
          port: { type: 'number', example: 5432 },
        },
      },
    },
  })
  findTypeList() {
    return this.databaseService.findTypeList();
  }
  @Get('/data')
  @ApiOperation({
    summary: '데이터 조회',
    description: '데이터셋 타입에 따라 데이터를 조회합니다.',
  })
  @ApiQuery({ name: 'datasetType', enum: DatasetType, description: '데이터셋 타입' })
  @ApiQuery({ name: 'databaseId', type: 'number', description: '데이터베이스 ID' })
  @ApiQuery({ name: 'datasetId', type: 'number', required: false, description: '데이터셋 ID' })
  @ApiQuery({ name: 'tableName', type: 'string', required: false, description: '테이블 이름' })
  @ApiOkResponse({
    description: '데이터 조회 성공',
    schema: {
      type: 'array',
      items: { type: 'object' },
    },
  })
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
  @ApiOperation({
    summary: '데이터베이스 연결정보 조회',
    description: '데이터베이스의 기본 연결 정보를 조회합니다.',
  })
  @ApiParam({ name: 'id', type: 'number', description: '데이터베이스 ID' })
  @ApiOkResponse({ description: '데이터베이스 연결정보' })
  @ApiNotFoundResponse({ description: '데이터베이스를 찾을 수 없습니다.' })
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
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  /**
   * 파일 업로드 → 서버 워커에서 DuckDB 데이터소스 생성
   * @param file
   */
  @Post('upload')
  @UseInterceptors(
    Utf8FileInterceptor('file', {
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
    return this.databaseService.uploadFile(
      file,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  @Get(':id/file-versions')
  fileVersions(@Param('id') id: string, @Req() req) {
    return this.databaseService.fileVersions(+id, this.access.actor(req.user.accessKeyData.id));
  }

  @Post(':id/file-replacement')
  @UseInterceptors(
    Utf8FileInterceptor('file', {
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
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  @Post(':id/file-restore')
  restoreFile(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.databaseService.restoreFile(
      +id,
      body,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  @Post('test')
  @ApiOperation({
    summary: '데이터베이스 연결 테스트',
    description: '데이터베이스 연결 설정이 올바른지 테스트합니다.',
  })
  @ApiOkResponse({
    description: '연결 테스트 결과',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Connection successful' },
      },
    },
  })
  @ApiBadRequestResponse({ description: '연결 실패' })
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
    @Headers('x-socket-id') socketId: string | undefined,
    @Req() req,
  ) {
    return this.connectionService.executeQuery(queryExecuteDto, socketId, {
      actor: this.access.actor(req.user.accessKeyData.id),
      epoch: req.user.accessKeyData.authVersion ?? 0,
    });
  }

  /**
   * 데이터베이스 목록 조회
   */
  @PredefinedFields('connectionBasic')
  @Get()
  async findAll(@Req() req) {
    const res = await this.databaseService.findAll();
    return this.access.filterResults('database', req.user.accessKeyData.id, res);
  }

  /**
   * 데이터베이스 상세 조회 - 데이터베이스 연결정보, 테이블, 데이터셋 조회
   * @param id
   */
  @FieldSelection({
    allowedFields: [
      'id',
      'name',
      'description',
      'engine',
      'type',
      'timezone',
      'createdAt',
      'updatedAt',
      'tables',
      'datasets',
    ],
    excludeFields: ['connectionConfig'],
  })
  @Get(':id')
  @ApiOperation({
    summary: '데이터베이스 상세 조회',
    description: '데이터베이스의 상세 정보와 테이블, 데이터셋을 조회합니다.',
  })
  @ApiParam({ name: 'id', type: 'number', description: '데이터베이스 ID' })
  @ApiQuery({ name: 'fields', required: false, description: '반환할 필드 선택' })
  @ApiOkResponse({ description: '데이터베이스 상세 정보' })
  @ApiNotFoundResponse({ description: '데이터베이스를 찾을 수 없습니다.' })
  async findOne(@Param('id') id: string, @Query('fields') fields?: string) {
    const databaseInfo = await this.databaseService.findOne(+id);
    return databaseInfo;
  }

  /**
   * database update
   * @param id
   * @param updateDatabaseDto
   */
  @Put(':id')
  update(@Param('id') id: string, @Body() updateDatabaseDto: UpdateDatabaseDto, @Req() req) {
    return this.databaseService.update(
      +id,
      updateDatabaseDto,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  /**
   * 스트리밍 쿼리 실행
   * @param queryExecuteDto 쿼리 실행 DTO
   * @param user 인증된 사용자 정보
   * @param res Express Response 객체
   */
  @Post('execute/stream')
  @ApiOperation({
    summary: '스트리밍 SQL 쿼리 실행',
    description: '대용량 데이터를 위한 스트리밍 방식으로 SQL 쿼리를 실행합니다.',
  })
  @ApiProduces('application/x-ndjson')
  @ApiHeader({ name: 'Transfer-Encoding', description: 'chunked' })
  @ApiOkResponse({
    description: '스트리밍 데이터',
    content: {
      'application/x-ndjson': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Header('Content-Type', 'application/x-ndjson')
  @Header('Cache-Control', 'no-cache')
  async executeStreamingQuery(
    @Body() queryExecuteDto: QueryExecuteDto,
    @GetUser() user: any,
    @Res() res: Response,
  ) {
    try {
      // 스트리밍 쿼리 실행
      const { stream, error } = await this.connectionService.executeStreamingQuery(
        queryExecuteDto,
        user?.userId || user?.id,
      );

      if (error) {
        return res.status(500).json({
          status: 'error',
          message: error,
        });
      }

      // 스트림을 응답에 파이프
      stream.pipe(res);

      // 스트림 에러 처리
      stream.on('error', err => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            status: 'error',
            message: 'Stream error occurred',
          });
        }
      });

      // 클라이언트 연결 종료 처리
      res.on('close', () => {
        stream.destroy();
      });
    } catch (error) {
      console.error('Streaming query error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          status: 'error',
          message: error.message || 'Failed to execute streaming query',
        });
      }
    }
  }
}
