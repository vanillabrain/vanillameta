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
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiHeader,
  ApiProduces
} from '@nestjs/swagger';
import {
  FieldSelection,
  PredefinedFields,
} from '../common/field-selection/field-selection.decorator';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('데이터베이스')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('AccessToken')
@Controller('database')
export class DatabaseController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly connectionService: ConnectionService,
  ) {}

  /**
   * database type 목록 조회
   */
  @Get('/type')
  @ApiOperation({ 
    summary: '데이터베이스 타입 목록 조회', 
    description: '지원하는 데이터베이스 타입의 목록을 조회합니다.' 
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
          port: { type: 'number', example: 5432 }
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
    description: '데이터셋 타입에 따라 데이터를 조회합니다.' 
  })
  @ApiQuery({ name: 'datasetType', enum: DatasetType, description: '데이터셋 타입' })
  @ApiQuery({ name: 'databaseId', type: 'number', description: '데이터베이스 ID' })
  @ApiQuery({ name: 'datasetId', type: 'number', required: false, description: '데이터셋 ID' })
  @ApiQuery({ name: 'tableName', type: 'string', required: false, description: '테이블 이름' })
  @ApiOkResponse({ 
    description: '데이터 조회 성공',
    schema: {
      type: 'array',
      items: { type: 'object' }
    }
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

  /**
   * 데이터베이스 연결정보 단순조회
   * @param id
   */
  @Get('/info/:id')
  @ApiOperation({ 
    summary: '데이터베이스 연결정보 조회', 
    description: '데이터베이스의 기본 연결 정보를 조회합니다.' 
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
  @ApiOperation({ 
    summary: '데이터베이스 연결 생성', 
    description: '새로운 데이터베이스 연결을 생성합니다.' 
  })
  @ApiCreatedResponse({ 
    description: '데이터베이스 연결이 성공적으로 생성되었습니다.',
    type: CreateDatabaseDto
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 데이터' })
  create(@Body() createDatabaseDto: CreateDatabaseDto) {
    return this.databaseService.create(createDatabaseDto);
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  @Post('test')
  @ApiOperation({ 
    summary: '데이터베이스 연결 테스트', 
    description: '데이터베이스 연결 설정이 올바른지 테스트합니다.' 
  })
  @ApiOkResponse({ 
    description: '연결 테스트 결과',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Connection successful' }
      }
    }
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
  @ApiOperation({ 
    summary: 'SQL 쿼리 실행', 
    description: '지정된 데이터베이스에서 SQL 쿼리를 실행합니다.' 
  })
  @ApiOkResponse({ 
    description: '쿼리 실행 결과',
    schema: {
      type: 'array',
      items: { type: 'object' }
    }
  })
  @ApiBadRequestResponse({ description: '잘못된 SQL 쿼리' })
  executeQuery(@Body() queryExecuteDto: QueryExecuteDto) {
    return this.connectionService.executeQuery(queryExecuteDto);
  }

  /**
   * 데이터베이스 목록 조회
   */
  @PredefinedFields('connectionBasic')
  @Get()
  @ApiOperation({ 
    summary: '데이터베이스 목록 조회', 
    description: '등록된 모든 데이터베이스 연결의 목록을 조회합니다.' 
  })
  @ApiQuery({ name: 'fields', required: false, description: '반환할 필드 선택' })
  @ApiOkResponse({ 
    description: '데이터베이스 목록',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          type: { type: 'string' },
          engine: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
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
  @ApiOperation({ 
    summary: '데이터베이스 상세 조회', 
    description: '데이터베이스의 상세 정보와 테이블, 데이터셋을 조회합니다.' 
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
  @ApiOperation({ 
    summary: '데이터베이스 연결 수정', 
    description: '데이터베이스 연결 정보를 수정합니다.' 
  })
  @ApiParam({ name: 'id', type: 'number', description: '데이터베이스 ID' })
  @ApiOkResponse({ description: '데이터베이스 연결이 성공적으로 수정되었습니다.' })
  @ApiNotFoundResponse({ description: '데이터베이스를 찾을 수 없습니다.' })
  @ApiBadRequestResponse({ description: '잘못된 요청 데이터' })
  update(@Param('id') id: string, @Body() updateDatabaseDto: UpdateDatabaseDto) {
    return this.databaseService.update(+id, updateDatabaseDto);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: '데이터베이스 연결 삭제', 
    description: '데이터베이스 연결을 삭제합니다.' 
  })
  @ApiParam({ name: 'id', type: 'number', description: '데이터베이스 ID' })
  @ApiOkResponse({ description: '데이터베이스 연결이 성공적으로 삭제되었습니다.' })
  @ApiNotFoundResponse({ description: '데이터베이스를 찾을 수 없습니다.' })
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
  @ApiOperation({ 
    summary: '스트리밍 SQL 쿼리 실행', 
    description: '대용량 데이터를 위한 스트리밍 방식으로 SQL 쿼리를 실행합니다.' 
  })
  @ApiProduces('application/x-ndjson')
  @ApiHeader({ name: 'Transfer-Encoding', description: 'chunked' })
  @ApiOkResponse({ 
    description: '스트리밍 데이터',
    content: {
      'application/x-ndjson': {
        schema: {
          type: 'string',
          format: 'binary'
        }
      }
    }
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
