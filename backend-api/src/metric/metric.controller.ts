import { SourceAccessService } from '../ownership/source-access.service';
import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';
import { Body, Controller, Get, Param, Post, Put, UseGuards, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateMetricDto, UpdateMetricDto } from './dto/metric.dto';
import { MetricService } from './metric.service';

@UseGuards(JwtAuthGuard, SourceOwnershipGuard)
@Controller('metric')
@ApiTags('metric')
export class MetricController {
  constructor(
    private readonly metricService: MetricService,
    private readonly access: SourceAccessService,
  ) {}

  /**
   * 메트릭 목록 조회 (시맨틱 레이어)
   */
  @Get()
  async findAll(@Req() req) {
    return this.access.filterResults(
      'metric',
      this.access.actor(req.user.accessKeyData.id),
      await this.metricService.findAll(),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.metricService.findOne(+id);
  }

  /**
   * 메트릭 정의 생성
   */
  @Post()
  create(@Body() createMetricDto: CreateMetricDto, @Req() req) {
    return this.metricService.create(
      createMetricDto,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateMetricDto: UpdateMetricDto, @Req() req) {
    return this.metricService.update(
      +id,
      updateMetricDto,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  /**
   * 메트릭 평가 — groupBy 있으면 그룹별 시리즈, 없으면 단일 값
   */
  @Post(':id/evaluate')
  evaluate(@Param('id') id: string) {
    return this.metricService.evaluate(+id);
  }
}
