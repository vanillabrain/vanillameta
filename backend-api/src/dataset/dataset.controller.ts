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

@UseGuards(JwtAuthGuard)
@Controller('dataset')
export class DatasetController {
  constructor(private readonly datasetService: DatasetService) {}

  /**
   * 데이터셋 생성
   * @param createDatasetDto
   */
  @Post()
  create(@Body() createDatasetDto: CreateDatasetDto) {
    return this.datasetService.create(createDatasetDto);
  }

  /**
   * 데이터셋 목록 조회
   */
  @UseInterceptors(PaginationInterceptor)
  @PredefinedFields('datasetMeta')
  @Get()
  findAll(
    @Pagination({ preferCursor: true, defaultLimit: 20 }) pagination: any,
    @Query('fields') fields?: string,
  ) {
    return this.datasetService.findAll(pagination);
  }

  /**
   * 데이터셋 단건 조회
   * @param id
   */
  @FieldSelection({
    allowedFields: ['id', 'title', 'databaseId', 'query', 'createdAt', 'updatedAt'],
    excludeFields: [],
  })
  @Get(':id')
  findOne(@Param('id') id: string, @Query('fields') fields?: string) {
    return this.datasetService.findOne(+id);
  }

  /**
   * 데이터셋 수정
   * @param id
   * @param updateDatasetDto
   */
  @Put(':id')
  update(@Param('id') id: number, @Body() updateDatasetDto: UpdateDatasetDto) {
    return this.datasetService.update(+id, updateDatasetDto);
  }

  /**
   * 데이터셋 제거
   * @param id
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.datasetService.remove(+id);
  }

  /**
   * 캐시된 데이터셋 쿼리 실행
   * @param id 데이터셋 ID
   * @param forceRefresh 강제 새로고침 여부
   * @param ttl 커스텀 TTL (초)
   * @param useStreamingFallback 캐시 오류 시 스트리밍 폴백 사용
   */
  @Get(':id/cached')
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

  /**
   * 데이터셋 캐시 무효화
   * @param id 데이터셋 ID
   */
  @Delete(':id/cache')
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

  /**
   * 데이터셋 캐시 통계 조회
   * @param id 데이터셋 ID
   */
  @Get(':id/cache/stats')
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

  /**
   * 데이터셋 스트리밍 쿼리 실행
   * @param id 데이터셋 ID
   * @param user 인증된 사용자 정보
   * @param res Express Response 객체
   */
  @Get(':id/stream')
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
