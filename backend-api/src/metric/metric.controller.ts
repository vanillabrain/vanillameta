import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateMetricDto, UpdateMetricDto } from './dto/metric.dto';
import { MetricService } from './metric.service';

@UseGuards(JwtAuthGuard)
@Controller('metric')
@ApiTags('metric')
export class MetricController {
  constructor(private readonly metricService: MetricService) {}

  /**
   * 메트릭 목록 조회 (시맨틱 레이어)
   */
  @Get()
  findAll() {
    return this.metricService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.metricService.findOne(+id);
  }

  /**
   * 메트릭 정의 생성
   */
  @Post()
  create(@Body() createMetricDto: CreateMetricDto) {
    return this.metricService.create(createMetricDto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateMetricDto: UpdateMetricDto) {
    return this.metricService.update(+id, updateMetricDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.metricService.remove(+id);
  }

  /**
   * 메트릭 평가 — groupBy 있으면 그룹별 시리즈, 없으면 단일 값
   */
  @Post(':id/evaluate')
  evaluate(@Param('id') id: string) {
    return this.metricService.evaluate(+id);
  }
}
