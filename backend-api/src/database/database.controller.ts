import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { QueryExecuteDto } from './dto/query-execute.dto';
import { ConnectionService } from '../connection/connection.service';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import {
  FieldSelection,
  PredefinedFields,
} from '../common/field-selection/field-selection.decorator';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('database')
@ApiTags('dashboard')
export class DatabaseController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly connectionService: ConnectionService,
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
  ) {
    const res = await this.databaseService.findData(datasetType, databaseId, datasetId, tableName);
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
   * 데이터베이스 테이블 목록 조회
   * @param id
   */
  @Get('/:id/tables')
  async findTables(@Param('id') id: string) {
    return this.databaseService.findTables(+id);
  }

  /**
   * 데이터베이스 생성 ( 데이터소스 생성)
   * @param createDatabaseDto
   */
  @Post()
  create(@Body() createDatabaseDto: CreateDatabaseDto) {
    return this.databaseService.create(createDatabaseDto);
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
  executeQuery(@Body() queryExecuteDto: QueryExecuteDto) {
    return this.connectionService.executeQuery(queryExecuteDto);
  }

  /**
   * 데이터베이스 목록 조회
   */
  @PredefinedFields('connectionBasic')
  @Get()
  async findAll(@Query('fields') fields?: string) {
    const res = await this.databaseService.findAll();
    return res;
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
  update(@Param('id') id: string, @Body() updateDatabaseDto: UpdateDatabaseDto) {
    return this.databaseService.update(+id, updateDatabaseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.databaseService.remove(+id);
  }

  /**
   * 스트리밍 쿼리 실행
   * @param queryExecuteDto 쿼리 실행 DTO
   * @param user 인증된 사용자 정보
   * @param res Express Response 객체
   */
  @Post('execute/stream')
  @Header('Content-Type', 'application/x-ndjson')
  @Header('Transfer-Encoding', 'chunked')
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
