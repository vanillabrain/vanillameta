import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import { BatchService } from './batch.service';
import { CreateBatchJobDto } from './dto/create-batch-job.dto';
import { BatchJobResponseDto, BatchChunkResponseDto } from './dto/batch-job-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

@ApiTags('batch')
@Controller('batch')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Post('jobs')
  @ApiOperation({ summary: '배치 작업 생성' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '배치 작업이 생성되었습니다.',
    type: BatchJobResponseDto,
  })
  async createBatchJob(
    @Body() createBatchJobDto: CreateBatchJobDto,
    @GetUser() user: any,
  ): Promise<BatchJobResponseDto> {
    const batchJob = await this.batchService.createBatchJob(createBatchJobDto, user.sub);

    return new BatchJobResponseDto({
      ...batchJob,
      progress: batchJob.progress,
      estimatedTimeRemaining: batchJob.estimatedTimeRemaining,
    });
  }

  @Get('jobs')
  @ApiOperation({ summary: '배치 작업 목록 조회' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '배치 작업 목록',
    type: [BatchJobResponseDto],
  })
  async findAllBatchJobs(@GetUser() user: any): Promise<BatchJobResponseDto[]> {
    const batchJobs = await this.batchService.findAll(user.sub);

    return batchJobs.map(
      job =>
        new BatchJobResponseDto({
          ...job,
          progress: job.progress,
          estimatedTimeRemaining: job.estimatedTimeRemaining,
        }),
    );
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: '배치 작업 상세 조회' })
  @ApiParam({ name: 'id', description: '배치 작업 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '배치 작업 상세 정보',
    type: BatchJobResponseDto,
  })
  async findOneBatchJob(@Param('id', ParseIntPipe) id: number): Promise<BatchJobResponseDto> {
    const batchJob = await this.batchService.findOne(id);

    return new BatchJobResponseDto({
      ...batchJob,
      progress: batchJob.progress,
      estimatedTimeRemaining: batchJob.estimatedTimeRemaining,
    });
  }

  @Get('jobs/:id/chunks')
  @ApiOperation({ summary: '배치 작업의 청크 목록 조회' })
  @ApiParam({ name: 'id', description: '배치 작업 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '배치 청크 목록',
    type: [BatchChunkResponseDto],
  })
  async findBatchChunks(@Param('id', ParseIntPipe) id: number): Promise<BatchChunkResponseDto[]> {
    const batchJob = await this.batchService.findOne(id);

    return batchJob.chunks.map(
      chunk =>
        new BatchChunkResponseDto({
          ...chunk,
          progress: chunk.progress,
          processingTime: chunk.processingTime,
        }),
    );
  }

  @Post('jobs/:id/restart')
  @ApiOperation({ summary: '배치 작업 재시작' })
  @ApiParam({ name: 'id', description: '배치 작업 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '배치 작업이 재시작되었습니다.',
    type: BatchJobResponseDto,
  })
  async restartBatchJob(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: any,
  ): Promise<BatchJobResponseDto> {
    const batchJob = await this.batchService.restartBatchJob(id, user.sub);

    return new BatchJobResponseDto({
      ...batchJob,
      progress: batchJob.progress,
      estimatedTimeRemaining: batchJob.estimatedTimeRemaining,
    });
  }

  @Post('jobs/:id/cancel')
  @ApiOperation({ summary: '배치 작업 취소' })
  @ApiParam({ name: 'id', description: '배치 작업 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '배치 작업이 취소되었습니다.',
    type: BatchJobResponseDto,
  })
  async cancelBatchJob(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: any,
  ): Promise<BatchJobResponseDto> {
    const batchJob = await this.batchService.cancelBatchJob(id, user.sub);

    return new BatchJobResponseDto({
      ...batchJob,
      progress: batchJob.progress,
      estimatedTimeRemaining: batchJob.estimatedTimeRemaining,
    });
  }
}
