import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req, Query } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { FieldSelection } from '../common/field-selection/field-selection.decorator';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post()
  @ApiBearerAuth('AccessKey')
  create(@Body() createDashboardDto: CreateDashboardDto, @Req() req) {
    const { accessKeyData } = req.user;
    console.log('asdf', accessKeyData);
    return this.dashboardService.create(createDashboardDto, accessKeyData.id);
  }

  @FieldSelection({
    allowedFields: [
      'id', 'title', 'description', 'createdAt', 'updatedAt',
      'widgets.id', 'widgets.name', 'widgets.type', 'widgets.order',
      'widgets.config.title', 'widgets.config.chartType',
      'widgets.config.layout'
    ],
    excludeFields: ['widgets.config.queries', 'widgets.data']
  })
  @Get()
  @ApiBearerAuth('AccessKey')
  findAll(@Req() req, @Query('fields') fields?: string) {
    const { accessKeyData } = req.user;
    return this.dashboardService.findAll(accessKeyData.id);
  }

  @FieldSelection({
    allowedFields: [
      'id', 'title', 'description', 'createdAt', 'updatedAt',
      'widgets.id', 'widgets.name', 'widgets.type', 'widgets.order',
      'widgets.config.title', 'widgets.config.chartType', 'widgets.config.layout',
      'widgets.config.xAxis', 'widgets.config.yAxis', 'widgets.config.groupBy',
      'widgets.dataset.id', 'widgets.dataset.name'
    ],
    excludeFields: ['widgets.config.queries', 'widgets.data', 'widgets.rawData']
  })
  @Get(':id')
  @ApiBearerAuth('AccessKey')
  findOne(@Param('id') id: string, @Query('fields') fields?: string) {
    return this.dashboardService.findOne(+id);
  }

  @Put(':id')
  @ApiBearerAuth('AccessKey')
  update(@Param('id') id: string, @Body() updateDashboardDto: UpdateDashboardDto) {
    return this.dashboardService.update(+id, updateDashboardDto);
  }

  @Delete(':id')
  @ApiBearerAuth('AccessKey')
  remove(@Param('id') id: string) {
    return this.dashboardService.remove(+id);
  }
}
