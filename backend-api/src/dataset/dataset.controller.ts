import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { DatasetService } from './dataset.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FieldSelection,
  PredefinedFields,
} from '../common/field-selection/field-selection.decorator';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Pagination, PaginationInterceptor } from '../common/pagination';

@ApiTags('데이터')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dataset')
export class DatasetController {
  constructor(private readonly datasetService: DatasetService) {}

  @Post()
  @ApiOperation({
    summary: '데이터셋 생성',
    description:
      '새로운 데이터셋을 생성합니다. 데이터셋은 데이터베이스 연결과 SQL 쿼리로 구성됩니다.',
  })
  @ApiResponse({
    status: 201,
    description: '데이터셋이 성공적으로 생성되었습니다.',
    type: CreateDatasetDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 SQL 쿼리 또는 데이터베이스 연결 오류',
  })
  create(@Body() createDatasetDto: CreateDatasetDto) {
    return this.datasetService.create(createDatasetDto);
  }

  /**
   * 데이터셋 목록 조회
   */
  @UseInterceptors(PaginationInterceptor)
  @PredefinedFields('datasetMeta')
  @Get()
  @ApiOperation({
    summary: '데이터셋 목록 조회',
    description: '생성된 모든 데이터셋 목록을 조회합니다.',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분)',
    example: 'id,title,databaseId,createdAt',
  })
  @ApiResponse({
    status: 200,
    description: '데이터셋 목록이 반환되었습니다.',
    type: [CreateDatasetDto],
  })
  findAll(
    @Pagination({ preferCursor: true, defaultLimit: 20 }) pagination: any,
    @Query('fields') fields?: string,
  ) {
    return this.datasetService.findAll(pagination);
  }

  @FieldSelection({
    allowedFields: ['id', 'title', 'databaseId', 'query', 'createdAt', 'updatedAt'],
    excludeFields: [],
  })
  @Get(':id')
  @ApiOperation({
    summary: '데이터셋 상세 조회',
    description: '특정 데이터셋의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터셋 ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분)',
    example: 'id,title,query',
  })
  @ApiResponse({
    status: 200,
    description: '데이터셋 정보가 반환되었습니다.',
    type: CreateDatasetDto,
  })
  @ApiResponse({
    status: 404,
    description: '데이터셋을 찾을 수 없습니다.',
  })
  findOne(@Param('id') id: string, @Query('fields') fields?: string) {
    return this.datasetService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({
    summary: '데이터셋 수정',
    description: '기존 데이터셋의 정보를 수정합니다. SQL 쿼리 변경 시 유효성 검사가 수행됩니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터셋 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '데이터셋이 성공적으로 수정되었습니다.',
    type: UpdateDatasetDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 SQL 쿼리 또는 요청 데이터',
  })
  @ApiResponse({
    status: 404,
    description: '데이터셋을 찾을 수 없습니다.',
  })
  update(@Param('id') id: number, @Body() updateDatasetDto: UpdateDatasetDto) {
    return this.datasetService.update(+id, updateDatasetDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '데이터셋 삭제',
    description: '데이터셋을 삭제합니다. 위젯에서 사용 중인 데이터셋은 삭제되지 않습니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터셋 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '데이터셋이 성공적으로 삭제되었습니다.',
  })
  @ApiResponse({
    status: 404,
    description: '데이터셋을 찾을 수 없습니다.',
  })
  @ApiResponse({
    status: 409,
    description: '사용 중인 데이터셋은 삭제할 수 없습니다.',
  })
  remove(@Param('id') id: string) {
    return this.datasetService.remove(+id);
  }

  @Get(':id/cached')
  @ApiOperation({
    summary: '캐시된 데이터셋 쿼리 실행',
    description:
      '데이터셋 쿼리를 캐시를 통해 실행합니다. 캐시가 없거나 만료된 경우 쿼리를 실행하고 결과를 캐시합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터셋 ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'forceRefresh',
    required: false,
    description: '캐시를 무시하고 강제로 새로 조회 (true/false)',
    type: Boolean,
    example: false,
  })
  @ApiQuery({
    name: 'ttl',
    required: false,
    description: '캐시 TTL(Time To Live) 커스텀 설정 (초 단위)',
    type: Number,
    example: 3600,
  })
  @ApiQuery({
    name: 'useStreamingFallback',
    required: false,
    description: '캐시 오류 시 스트리밍으로 폴백 (true/false)',
    type: Boolean,
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: '캐시된 쿼리 결과가 반환되었습니다.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', description: '쿼리 결과 데이터' },
        cached: { type: 'boolean', description: '캐시에서 가져온 데이터 여부' },
        cacheKey: { type: 'string', description: '캐시 키' },
        ttl: { type: 'number', description: '캐시 TTL (초)' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '데이터셋을 찾을 수 없습니다.',
  })
  @ApiResponse({
    status: 500,
    description: '쿼리 실행 중 오류가 발생했습니다.',
  })
  async executeCachedQuery(
    @Param('id') id: string,
    @Query('forceRefresh') forceRefresh?: boolean,
    @Query('ttl') ttl?: number,
    @Query('useStreamingFallback') useStreamingFallback?: boolean,
  ) {
    return this.datasetService.executeCachedQuery(+id, {
      forceRefresh: forceRefresh === true,
      customTtl: ttl ? parseInt(ttl.toString()) : undefined,
      useStreamingFallback: useStreamingFallback === true,
    });
  }

  @Delete(':id/cache')
  @ApiOperation({
    summary: '데이터셋 캐시 무효화',
    description: '특정 데이터셋의 캐시를 삭제합니다. 다음 요청 시 새로운 데이터를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터셋 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '캐시가 성공적으로 무효화되었습니다.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: '데이터셋 1의 캐시가 무효화되었습니다.' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '데이터셋을 찾을 수 없습니다.',
  })
  @ApiResponse({
    status: 500,
    description: '캐시 무효화 중 오류가 발생했습니다.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', description: '오류 메시지' },
      },
    },
  })
  async invalidateDatasetCache(@Param('id') id: string) {
    try {
      await this.datasetService.invalidateDatasetCache(+id);
      return {
        status: 'success',
        message: `데이터셋 ${id}의 캐시가 무효화되었습니다.`,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  @Get(':id/cache/stats')
  @ApiOperation({
    summary: '데이터셋 캐시 통계 조회',
    description:
      '특정 데이터셋의 캐시 사용 통계를 조회합니다. 히트율, 미스율, 마지막 액세스 시간 등의 정보를 제공합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터셋 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '캐시 통계가 반환되었습니다.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        data: {
          type: 'object',
          properties: {
            hitRate: { type: 'number', description: '캐시 히트율 (%)', example: 85.5 },
            missRate: { type: 'number', description: '캐시 미스율 (%)', example: 14.5 },
            totalHits: { type: 'number', description: '총 캐시 히트 수', example: 1523 },
            totalMisses: { type: 'number', description: '총 캐시 미스 수', example: 258 },
            averageLoadTime: { type: 'number', description: '평균 로드 시간 (ms)', example: 45.2 },
            memoryUsage: { type: 'number', description: '메모리 사용량 (MB)', example: 12.5 },
            lastAccessed: {
              type: 'string',
              description: '마지막 액세스 시간',
              example: '2024-01-15T10:30:00Z',
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '데이터셋을 찾을 수 없습니다.',
  })
  @ApiResponse({
    status: 500,
    description: '통계 조회 중 오류가 발생했습니다.',
  })
  async getDatasetCacheStats(@Param('id') id: string) {
    try {
      // 데이터셋 정보를 통해 엔진 타입을 알아내서 해당 엔진의 통계 조회
      const dataset = await this.datasetService.findOne(+id);
      // TODO: 데이터셋에서 엔진 정보 추출 후 캐시 통계 조회
      const stats = await this.datasetService.getCacheStats();

      return {
        status: 'success',
        data: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
      };
    }
  }

  @Get(':id/stream')
  @ApiOperation({
    summary: '데이터셋 스트리밍 쿼리 실행',
    description:
      '대용량 데이터셋을 NDJSON(Newline Delimited JSON) 형식으로 스트리밍합니다. 메모리 효율적인 처리를 위해 청크 단위로 데이터를 전송합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터셋 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '데이터 스트리밍이 시작되었습니다.',
    headers: {
      'Content-Type': {
        description: 'NDJSON 형식 스트림',
        schema: { type: 'string', default: 'application/x-ndjson' },
      },
      'Transfer-Encoding': {
        description: '청크 전송 인코딩',
        schema: { type: 'string', default: 'chunked' },
      },
    },
    content: {
      'application/x-ndjson': {
        schema: {
          type: 'string',
          example: '{"id":1,"name":"Item 1"}\n{"id":2,"name":"Item 2"}\n{"id":3,"name":"Item 3"}\n',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '데이터셋을 찾을 수 없습니다.',
  })
  @ApiResponse({
    status: 500,
    description: '스트리밍 중 오류가 발생했습니다.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', description: '오류 메시지' },
      },
    },
  })
  @Header('Content-Type', 'application/x-ndjson')
  @Header('Transfer-Encoding', 'chunked')
  @Header('Cache-Control', 'no-cache')
  async streamQuery(@Param('id') id: string, @GetUser() user: any, @Res() res: Response) {
    try {
      // 스트리밍 쿼리 실행
      const { stream, error } = await this.datasetService.executeStreamingQuery(
        +id,
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
