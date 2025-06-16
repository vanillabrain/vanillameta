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
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiParam,
  ApiQuery,
  ApiBody
} from '@nestjs/swagger';
import {
  FieldSelection,
  PredefinedFields,
} from '../common/field-selection/field-selection.decorator';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('데이터')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('database')
export class DatabaseController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly connectionService: ConnectionService,
  ) {}

  @Get('/type')
  @ApiOperation({ 
    summary: '데이터베이스 타입 목록 조회',
    description: '지원하는 데이터베이스 엔진 타입 목록을 조회합니다 (MySQL, PostgreSQL, Oracle 등).'
  })
  @ApiResponse({ 
    status: 200, 
    description: '데이터베이스 타입 목록이 반환되었습니다.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string', example: 'mysql' },
          label: { type: 'string', example: 'MySQL' },
          port: { type: 'number', example: 3306 }
        }
      }
    }
  })
  findTypeList() {
    return this.databaseService.findTypeList();
  }
  @Get('/data')
  @ApiOperation({ 
    summary: '데이터 조회',
    description: '데이터셋 또는 테이블에서 데이터를 조회합니다.'
  })
  @ApiQuery({
    name: 'datasetType',
    required: true,
    enum: DatasetType,
    description: '데이터셋 타입'
  })
  @ApiQuery({
    name: 'databaseId',
    required: true,
    type: Number,
    description: '데이터베이스 ID'
  })
  @ApiQuery({
    name: 'datasetId',
    required: false,
    type: Number,
    description: '데이터셋 ID (datasetType이 DATASET일 때 필수)'
  })
  @ApiQuery({
    name: 'tableName',
    required: false,
    type: String,
    description: '테이블 이름 (datasetType이 TABLE일 때 필수)'
  })
  @ApiResponse({ 
    status: 200, 
    description: '데이터가 성공적으로 조회되었습니다.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: '잘못된 요청 파라미터' 
  })
  async findData(
    @Query('datasetType') datasetType: DatasetType,
    @Query('databaseId') databaseId: number,
    @Query('datasetId') datasetId?: number,
    @Query('tableName') tableName?: string,
  ) {
    const res = await this.databaseService.findData(datasetType, databaseId, datasetId, tableName);
    return res;
  }

  @Get('/info/:id')
  @ApiOperation({ 
    summary: '데이터베이스 연결정보 단순 조회',
    description: '데이터베이스 연결 정보만 조회합니다 (민감한 정보 제외).'
  })
  @ApiParam({
    name: 'id',
    description: '데이터베이스 ID',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: '데이터베이스 정보가 반환되었습니다.',
    type: CreateDatabaseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '데이터베이스를 찾을 수 없습니다.' 
  })
  async findOneInfo(@Param('id') id: string) {
    const databaseInfo = await this.databaseService.findOneInfo(+id);
    return databaseInfo;
  }

  /**
   * 데이터베이스 테이블 목록 조회
   * @param id
   */
  @Get('/:id/tables')
  @ApiOperation({ 
    summary: '데이터베이스 테이블 목록 조회',
    description: '특정 데이터베이스의 모든 테이블 목록을 조회합니다.'
  })
  @ApiParam({
    name: 'id',
    description: '데이터베이스 ID',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: '테이블 목록이 성공적으로 조회되었습니다.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tableName: { type: 'string', example: 'users' },
          tableType: { type: 'string', example: 'BASE TABLE' },
          rowCount: { type: 'number', example: 150 }
        }
      }
    }
  })
  async findTables(@Param('id') id: string) {
    return this.databaseService.findTables(+id);
  }

  @Post()
  @ApiOperation({ 
    summary: '데이터베이스 연결 생성',
    description: '새로운 데이터베이스 연결을 생성합니다. 연결 정보는 암호화되어 저장됩니다.'
  })
  @ApiResponse({ 
    status: 201, 
    description: '데이터베이스 연결이 성공적으로 생성되었습니다.',
    type: CreateDatabaseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: '잘못된 연결 정보 또는 중복된 연결명' 
  })
  create(@Body() createDatabaseDto: CreateDatabaseDto) {
    return this.databaseService.create(createDatabaseDto);
  }

  @Post('test')
  @ApiOperation({ 
    summary: '데이터베이스 연결 테스트',
    description: '제공된 연결 정보로 데이터베이스 연결을 테스트합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '연결 테스트 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '연결 성공' },
        version: { type: 'string', example: 'MySQL 8.0.28' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: '연결 테스트 실패',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '연결 실패: Connection refused' }
      }
    }
  })
  testConnection(@Body() createDatabaseDto: CreateDatabaseDto) {
    return this.connectionService.testConnection(createDatabaseDto);
  }

  @Post('execute')
  @ApiOperation({ 
    summary: 'SQL 쿼리 실행',
    description: '지정된 데이터베이스에서 SQL 쿼리를 실행합니다.'
  })
  @ApiBody({
    type: QueryExecuteDto,
    description: '쿼리 실행 정보'
  })
  @ApiResponse({ 
    status: 200, 
    description: '쿼리 실행 성공',
    schema: {
      type: 'object',
      properties: {
        data: { 
          type: 'array', 
          description: '쿼리 결과',
          items: { type: 'object' }
        },
        fields: {
          type: 'array',
          description: '필드 정보',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' }
            }
          }
        },
        rowCount: { type: 'number', description: '결과 행 수' },
        executionTime: { type: 'number', description: '실행 시간 (ms)' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'SQL 문법 오류 또는 권한 부족' 
  })
  @ApiResponse({ 
    status: 500, 
    description: '쿼리 실행 중 오류 발생' 
  })
  executeQuery(@Body() queryExecuteDto: QueryExecuteDto) {
    return this.connectionService.executeQuery(queryExecuteDto);
  }

  @PredefinedFields('connectionBasic')
  @Get()
  @ApiOperation({ 
    summary: '데이터베이스 연결 목록 조회',
    description: '등록된 모든 데이터베이스 연결 목록을 조회합니다.'
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분). connectionBasic 필드 셋 사용',
    example: 'id,name,engine,type'
  })
  @ApiResponse({ 
    status: 200, 
    description: '데이터베이스 연결 목록이 반환되었습니다.',
    type: [CreateDatabaseDto]
  })
  async findAll(@Query('fields') fields?: string) {
    const res = await this.databaseService.findAll();
    return res;
  }

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
    description: '데이터베이스 연결 정보, 테이블 목록, 데이터셋 목록을 포함한 상세 정보를 조회합니다.'
  })
  @ApiParam({
    name: 'id',
    description: '데이터베이스 ID',
    type: Number,
    example: 1
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분). 허용된 필드: id, name, description, engine, type, timezone, createdAt, updatedAt, tables, datasets',
    example: 'id,name,engine,tables,datasets'
  })
  @ApiResponse({ 
    status: 200, 
    description: '데이터베이스 상세 정보가 반환되었습니다.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        description: { type: 'string' },
        engine: { type: 'string' },
        type: { type: 'string' },
        timezone: { type: 'string' },
        tables: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              columns: { type: 'array' }
            }
          }
        },
        datasets: { type: 'array', items: { type: 'object' } }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: '데이터베이스를 찾을 수 없습니다.' 
  })
  async findOne(@Param('id') id: string, @Query('fields') fields?: string) {
    const databaseInfo = await this.databaseService.findOne(+id);
    return databaseInfo;
  }

  @Put(':id')
  @ApiOperation({ 
    summary: '데이터베이스 연결 정보 수정',
    description: '기존 데이터베이스 연결 정보를 수정합니다.'
  })
  @ApiParam({
    name: 'id',
    description: '데이터베이스 ID',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: '데이터베이스 연결 정보가 성공적으로 수정되었습니다.',
    type: UpdateDatabaseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '데이터베이스를 찾을 수 없습니다.' 
  })
  update(@Param('id') id: string, @Body() updateDatabaseDto: UpdateDatabaseDto) {
    return this.databaseService.update(+id, updateDatabaseDto);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: '데이터베이스 연결 삭제',
    description: '데이터베이스 연결을 삭제합니다. 관련된 데이터셋과 위젯이 있으면 삭제할 수 없습니다.'
  })
  @ApiParam({
    name: 'id',
    description: '데이터베이스 ID',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: '데이터베이스 연결이 성공적으로 삭제되었습니다.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: '데이터베이스를 찾을 수 없습니다.' 
  })
  @ApiResponse({ 
    status: 409, 
    description: '사용 중인 데이터베이스 연결은 삭제할 수 없습니다.' 
  })
  remove(@Param('id') id: string) {
    return this.databaseService.remove(+id);
  }

  @Post('execute/stream')
  @ApiOperation({ 
    summary: 'SQL 쿼리 스트리밍 실행',
    description: '대용량 쿼리 결과를 NDJSON 형식으로 스트리밍합니다. 메모리 효율적인 처리를 위해 청크 단위로 데이터를 전송합니다.'
  })
  @ApiBody({
    type: QueryExecuteDto,
    description: '쿼리 실행 정보'
  })
  @ApiResponse({ 
    status: 200, 
    description: '스트리밍이 시작되었습니다.',
    headers: {
      'Content-Type': {
        description: 'NDJSON 형식 스트림',
        schema: { type: 'string', default: 'application/x-ndjson' }
      },
      'Transfer-Encoding': {
        description: '청크 전송 인코딩',
        schema: { type: 'string', default: 'chunked' }
      }
    },
    content: {
      'application/x-ndjson': {
        schema: {
          type: 'string',
          example: '{"id":1,"name":"Item 1"}\n{"id":2,"name":"Item 2"}\n{"id":3,"name":"Item 3"}\n'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: '스트리밍 중 오류가 발생했습니다.' 
  })
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
