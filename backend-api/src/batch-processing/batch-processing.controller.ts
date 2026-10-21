import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { BatchProcessingService } from './batch-processing.service';
import { BatchExecuteDto } from './dto/batch-execute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('api/v1/batch')
@UseGuards(JwtAuthGuard)
export class BatchProcessingController {
  constructor(private readonly batchProcessingService: BatchProcessingService) {}

  /**
   * 배치 처리 실행 (스트리밍 응답)
   * @param batchDto 배치 실행 요청
   * @param res Express Response 객체
   */
  @Post('execute/stream')
  @HttpCode(HttpStatus.OK)
  async executeBatchStreaming(
    @Body() batchDto: BatchExecuteDto,
    @Res() res: Response,
    @GetUser() user?: any,
  ): Promise<void> {
    // 사용자 정보를 로깅용으로 활용할 수 있음
    await this.batchProcessingService.executeBatchStreaming(batchDto, res);
  }

  /**
   * 배치 처리 실행 (일반 응답)
   * @param batchDto 배치 실행 요청
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executeBatch(@Body() batchDto: BatchExecuteDto, @GetUser() user?: any) {
    return await this.batchProcessingService.executeBatch(batchDto);
  }

  /**
   * 배치 진행 상황 조회
   * @param batchId 배치 ID
   */
  @Get(':batchId/progress')
  async getBatchProgress(@Param('batchId') batchId: string) {
    return await this.batchProcessingService.getBatchProgress(batchId);
  }

  /**
   * 배치 취소
   * @param batchId 배치 ID
   */
  @Delete(':batchId')
  async cancelBatch(@Param('batchId') batchId: string) {
    return await this.batchProcessingService.cancelBatch(batchId);
  }

  /**
   * 활성 배치 목록 조회
   */
  @Get('active')
  async getActiveBatches() {
    return await this.batchProcessingService.getActiveBatches();
  }

  /**
   * 시스템 상태 조회
   */
  @Get('system/status')
  async getSystemStatus() {
    return await this.batchProcessingService.getSystemStatus();
  }

  /**
   * 배치 처리 테스트 (개발용)
   * 작은 데이터셋으로 배치 처리 기능 테스트
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testBatchProcessing(
    @Body()
    testDto: {
      databaseId: number;
      chunkSize?: number;
      enableStreaming?: boolean;
    },
    @GetUser() user?: any,
  ) {
    // 테스트용 간단한 쿼리
    const batchDto: BatchExecuteDto = {
      databaseId: testDto.databaseId,
      query:
        "SELECT * FROM (SELECT 1 as id, 'test' as name UNION ALL SELECT 2, 'test2' UNION ALL SELECT 3, 'test3') test_table",
      chunkSize: testDto.chunkSize || 2,
      totalLimit: 10,
      enableStreaming: testDto.enableStreaming || false,
      enableProgressTracking: true,
    };

    return await this.batchProcessingService.executeBatch(batchDto);
  }

  /**
   * 배치 처리 스트리밍 테스트 (개발용)
   */
  @Post('test/stream')
  @HttpCode(HttpStatus.OK)
  async testBatchStreamProcessing(
    @Body()
    testDto: {
      databaseId: number;
      chunkSize?: number;
    },
    @Res() res: Response,
    @GetUser() user?: any,
  ): Promise<void> {
    // 테스트용 간단한 쿼리
    const batchDto: BatchExecuteDto = {
      databaseId: testDto.databaseId,
      query:
        "SELECT * FROM (SELECT 1 as id, 'test' as name UNION ALL SELECT 2, 'test2' UNION ALL SELECT 3, 'test3') test_table",
      chunkSize: testDto.chunkSize || 2,
      totalLimit: 10,
      enableStreaming: true,
      enableProgressTracking: true,
    };

    await this.batchProcessingService.executeBatchStreaming(batchDto, res);
  }
}
