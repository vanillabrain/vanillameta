import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { BackgroundJobService } from './background-job.service';
import { CreateBackgroundJobDto } from './dto/create-background-job.dto';
import {
  BackgroundJobResponseDto,
  BackgroundJobListResponseDto,
} from './dto/background-job-response.dto';
import { JobResultResponseDto } from './dto/job-result-response.dto';

@ApiTags('Background Jobs')
@Controller('v1/background-jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BackgroundJobController {
  constructor(private readonly backgroundJobService: BackgroundJobService) {}

  @Post()
  @ApiOperation({ summary: '백그라운드 작업 생성' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '작업이 성공적으로 생성됨',
    type: BackgroundJobResponseDto,
  })
  async createJob(
    @GetUser() user: any,
    @Body() createJobDto: CreateBackgroundJobDto,
  ): Promise<BackgroundJobResponseDto> {
    return this.backgroundJobService.createJob(user.userId, createJobDto);
  }

  @Get()
  @ApiOperation({ summary: '사용자의 백그라운드 작업 목록 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '작업 목록 조회 성공',
    type: BackgroundJobListResponseDto,
  })
  async getJobs(
    @GetUser() user: any,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ): Promise<BackgroundJobListResponseDto> {
    return this.backgroundJobService.getJobsByUser(user.userId, Number(page), Number(pageSize));
  }

  @Get(':jobId')
  @ApiOperation({ summary: '특정 백그라운드 작업 상태 조회' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '작업 상태 조회 성공',
    type: BackgroundJobResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '작업을 찾을 수 없음',
  })
  async getJob(
    @GetUser() user: any,
    @Param('jobId') jobId: string,
  ): Promise<BackgroundJobResponseDto> {
    return this.backgroundJobService.getJobById(jobId, user.userId);
  }

  @Get(':jobId/result')
  @ApiOperation({ summary: '백그라운드 작업 결과 메타데이터 조회' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '작업 결과 메타데이터 조회 성공',
    type: JobResultResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '작업 또는 결과를 찾을 수 없음',
  })
  async getJobResult(
    @GetUser() user: any,
    @Param('jobId') jobId: string,
  ): Promise<JobResultResponseDto> {
    return this.backgroundJobService.getJobResult(jobId, user.userId);
  }

  @Get(':jobId/result/data')
  @ApiOperation({ summary: '백그라운드 작업 결과 데이터 조회' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '작업 결과 데이터 조회 성공',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '작업 또는 결과를 찾을 수 없음',
  })
  async getJobResultData(@GetUser() user: any, @Param('jobId') jobId: string): Promise<any> {
    return this.backgroundJobService.getJobResultData(jobId, user.userId);
  }

  @Delete(':jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '백그라운드 작업 취소' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: '작업이 성공적으로 취소됨',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '작업을 찾을 수 없음',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '작업을 취소할 수 없는 상태',
  })
  async cancelJob(@GetUser() user: any, @Param('jobId') jobId: string): Promise<void> {
    await this.backgroundJobService.cancelJob(jobId, user.userId);
  }
}
