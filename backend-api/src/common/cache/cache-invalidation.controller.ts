import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  Get,
  UseGuards,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CacheInvalidationService, InvalidationPolicy } from './cache-invalidation.service';

/**
 * 캐시 무효화 관리 API
 */
@ApiTags('캐시 무효화')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('cache/invalidate')
export class CacheInvalidationController {
  constructor(private readonly cacheInvalidationService: CacheInvalidationService) {}

  /**
   * 데이터셋 캐시 무효화
   */
  @Delete('dataset/:id')
  @ApiOperation({
    summary: '데이터셋 캐시 무효화',
    description: '특정 데이터셋의 캐시를 무효화합니다. cascade 옵션으로 연관된 대시보드 캐시도 무효화할 수 있습니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터셋 ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'cascade',
    required: false,
    description: '연관된 캐시도 무효화 (true/false)',
    type: Boolean,
    example: false,
  })
  @ApiQuery({
    name: 'async',
    required: false,
    description: '비동기 처리 여부 (true/false)',
    type: Boolean,
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: '캐시가 성공적으로 무효화되었습니다.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        invalidated: {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'dataset' },
            id: { type: 'number', example: 1 },
            cascade: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  async invalidateDataset(
    @Param('id') id: string,
    @Query('cascade') cascade?: boolean,
    @Query('async') async?: boolean,
  ) {
    try {
      const policy: InvalidationPolicy = {
        immediate: !async,
        cascade: cascade === true,
        async: async === true,
      };

      await this.cacheInvalidationService.invalidateDataset(+id, policy);

      return {
        status: 'success',
        message: `데이터셋 ${id}의 캐시가 무효화${async ? ' 요청' : ''}되었습니다.`,
        invalidated: {
          type: 'dataset',
          id: +id,
          cascade: cascade === true,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 대시보드 캐시 무효화
   */
  @Delete('dashboard/:id')
  @ApiOperation({
    summary: '대시보드 캐시 무효화',
    description: '특정 대시보드의 캐시를 무효화합니다. cascade 옵션으로 위젯과 데이터셋 캐시도 무효화할 수 있습니다.',
  })
  @ApiParam({
    name: 'id',
    description: '대시보드 ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'cascade',
    required: false,
    description: '연관된 캐시도 무효화 (true/false)',
    type: Boolean,
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: '캐시가 성공적으로 무효화되었습니다.',
  })
  async invalidateDashboard(
    @Param('id') id: string,
    @Query('cascade') cascade?: boolean,
  ) {
    try {
      const policy: InvalidationPolicy = {
        immediate: true,
        cascade: cascade === true,
        async: false,
      };

      await this.cacheInvalidationService.invalidateDashboard(+id, policy);

      return {
        status: 'success',
        message: `대시보드 ${id}의 캐시가 무효화되었습니다.`,
        invalidated: {
          type: 'dashboard',
          id: +id,
          cascade: cascade === true,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 데이터베이스별 캐시 무효화
   */
  @Delete('database/:id')
  @ApiOperation({
    summary: '데이터베이스별 캐시 무효화',
    description: '특정 데이터베이스의 모든 캐시를 무효화합니다. 대량의 캐시가 삭제될 수 있으므로 주의가 필요합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '데이터베이스 ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'cascade',
    required: false,
    description: '연관된 모든 데이터셋과 대시보드 캐시도 무효화 (true/false)',
    type: Boolean,
    example: false,
  })
  @ApiQuery({
    name: 'batchSize',
    required: false,
    description: '배치 처리 크기',
    type: Number,
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: '캐시가 성공적으로 무효화되었습니다.',
  })
  async invalidateDatabase(
    @Param('id') id: string,
    @Query('cascade') cascade?: boolean,
    @Query('batchSize') batchSize?: string,
  ) {
    try {
      const policy: InvalidationPolicy = {
        immediate: false,
        cascade: cascade === true,
        async: true,
        batchSize: batchSize ? +batchSize : undefined,
      };

      await this.cacheInvalidationService.invalidateDatabase(+id, policy);

      return {
        status: 'success',
        message: `데이터베이스 ${id}의 캐시 무효화가 시작되었습니다.`,
        invalidated: {
          type: 'database',
          id: +id,
          cascade: cascade === true,
          async: true,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 사용자별 캐시 무효화
   */
  @Delete('user/:id')
  @ApiOperation({
    summary: '사용자별 캐시 무효화',
    description: '특정 사용자의 캐시를 무효화합니다. 주로 사용자 대시보드 목록 캐시가 대상입니다.',
  })
  @ApiParam({
    name: 'id',
    description: '사용자 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '캐시가 성공적으로 무효화되었습니다.',
  })
  async invalidateUserCache(@Param('id') id: string) {
    try {
      await this.cacheInvalidationService.invalidateUserCache(+id);

      return {
        status: 'success',
        message: `사용자 ${id}의 캐시가 무효화되었습니다.`,
        invalidated: {
          type: 'user',
          id: +id,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 패턴 기반 캐시 무효화
   */
  @Post('pattern')
  @ApiOperation({
    summary: '패턴 기반 캐시 무효화',
    description: '특정 패턴과 일치하는 모든 캐시를 무효화합니다. 와일드카드(*)를 사용할 수 있습니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '캐시 키 패턴 (예: dashboard:*, user_dashboards:123)',
          example: 'dashboard:*',
        },
        engine: {
          type: 'string',
          description: '엔진 타입',
          example: 'dashboard',
        },
      },
      required: ['pattern'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '패턴과 일치하는 캐시가 무효화되었습니다.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string' },
        invalidated: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            engine: { type: 'string' },
            count: { type: 'number' },
          },
        },
      },
    },
  })
  async invalidateByPattern(
    @Body() body: { pattern: string; engine?: string },
  ) {
    try {
      const count = await this.cacheInvalidationService.invalidateByPattern(
        body.pattern,
        body.engine,
      );

      return {
        status: 'success',
        message: `패턴 '${body.pattern}'과 일치하는 캐시가 무효화되었습니다.`,
        invalidated: {
          pattern: body.pattern,
          engine: body.engine || 'dashboard',
          count,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '패턴 기반 캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 전체 캐시 무효화
   */
  @Delete('all')
  @ApiOperation({
    summary: '전체 캐시 무효화',
    description: '모든 캐시를 무효화합니다. 주의: 성능에 큰 영향을 줄 수 있습니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: '전체 캐시 무효화 확인',
          example: true,
        },
      },
      required: ['confirm'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '모든 캐시가 무효화되었습니다.',
  })
  @ApiResponse({
    status: 400,
    description: '확인이 필요합니다.',
  })
  async invalidateAll(@Body() body: { confirm: boolean }) {
    if (!body.confirm) {
      throw new HttpException(
        {
          status: 'error',
          message: '전체 캐시 무효화를 확인해주세요 (confirm: true)',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.cacheInvalidationService.invalidateAll();

      return {
        status: 'success',
        message: '모든 캐시가 무효화되었습니다.',
        warning: '성능에 일시적인 영향이 있을 수 있습니다.',
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '전체 캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 무효화 큐 상태 조회
   */
  @Get('queue/status')
  @ApiOperation({
    summary: '무효화 큐 상태 조회',
    description: '비동기 캐시 무효화 큐의 현재 상태를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '큐 상태가 반환되었습니다.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'success' },
        queue: {
          type: 'object',
          properties: {
            size: { type: 'number', example: 5 },
            processing: { type: 'boolean', example: true },
            stats: {
              type: 'object',
              properties: {
                totalInvalidations: { type: 'number' },
                cascadedInvalidations: { type: 'number' },
                failedInvalidations: { type: 'number' },
              },
            },
          },
        },
      },
    },
  })
  async getQueueStatus() {
    try {
      const stats = await this.cacheInvalidationService.getInvalidationStats();

      return {
        status: 'success',
        queue: {
          size: stats.queueSize,
          processing: stats.isProcessing,
          stats: stats.stats,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '큐 상태 조회 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 위젯 캐시 무효화
   */
  @Delete('widget/:widgetId/dashboard/:dashboardId')
  @ApiOperation({
    summary: '위젯 캐시 무효화',
    description: '특정 위젯과 관련된 캐시를 무효화합니다.',
  })
  @ApiParam({
    name: 'widgetId',
    description: '위젯 ID',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'dashboardId',
    description: '대시보드 ID',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'cascade',
    required: false,
    description: '연관된 데이터셋 캐시도 무효화 (true/false)',
    type: Boolean,
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: '캐시가 성공적으로 무효화되었습니다.',
  })
  async invalidateWidget(
    @Param('widgetId') widgetId: string,
    @Param('dashboardId') dashboardId: string,
    @Query('cascade') cascade?: boolean,
  ) {
    try {
      const policy: InvalidationPolicy = {
        immediate: true,
        cascade: cascade === true,
        async: false,
      };

      await this.cacheInvalidationService.invalidateWidget(
        +widgetId,
        +dashboardId,
        policy,
      );

      return {
        status: 'success',
        message: `위젯 ${widgetId}의 캐시가 무효화되었습니다.`,
        invalidated: {
          type: 'widget',
          widgetId: +widgetId,
          dashboardId: +dashboardId,
          cascade: cascade === true,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: '캐시 무효화 중 오류가 발생했습니다.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}