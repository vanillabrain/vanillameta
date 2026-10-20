import { FieldSelection } from '../common/field-selection/field-selection.decorator';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SourceAccessService } from '../ownership/source-access.service';
import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';
import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PersonalViewService } from './personal-view.service';

@UseGuards(JwtAuthGuard, SourceOwnershipGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly access: SourceAccessService,
    private readonly views: PersonalViewService,
  ) {}

  @Post()
  @ApiOperation({
    summary: '대시보드 생성',
    description: '새로운 대시보드를 생성합니다.',
  })
  @ApiCreatedResponse({
    description: '대시보드가 성공적으로 생성되었습니다.',
    type: CreateDashboardDto,
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 데이터' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  create(@Body() createDashboardDto: CreateDashboardDto, @Req() req) {
    const { accessKeyData } = req.user;
    return this.dashboardService.create(
      createDashboardDto,
      accessKeyData.id,
      accessKeyData.authVersion ?? 0,
    );
  }

  @FieldSelection({
    allowedFields: [
      'id',
      'title',
      'description',
      'createdAt',
      'updatedAt',
      'widgets.id',
      'widgets.name',
      'widgets.type',
      'widgets.order',
      'widgets.config.title',
      'widgets.config.chartType',
      'widgets.config.layout',
    ],
    excludeFields: ['widgets.config.queries', 'widgets.data'],
  })
  @Get()
  @ApiBearerAuth('AccessKey')
  async findAll(@Req() req) {
    const { accessKeyData } = req.user;
    return this.access.filterResults(
      'dashboard',
      accessKeyData.id,
      await this.dashboardService.findAll(
        accessKeyData.id,
        await this.access.readableDashboardIds(accessKeyData.id),
      ),
      'read',
    );
  }

  @FieldSelection({
    allowedFields: [
      'id',
      'title',
      'description',
      'createdAt',
      'updatedAt',
      'widgets.id',
      'widgets.name',
      'widgets.type',
      'widgets.order',
      'widgets.config.title',
      'widgets.config.chartType',
      'widgets.config.layout',
      'widgets.config.xAxis',
      'widgets.config.yAxis',
      'widgets.config.groupBy',
      'widgets.dataset.id',
      'widgets.dataset.name',
    ],
    excludeFields: ['widgets.config.queries', 'widgets.data', 'widgets.rawData'],
  })
  @Get(':id')
  @ApiBearerAuth('AccessKey')
  async findOne(@Param('id') id: string, @Req() req) {
    const actor = req.user.accessKeyData.id;
    const dashboardId = this.access.id(id);
    await this.access.dashboard(dashboardId, actor, 'read');
    return this.dashboardService.findOne(dashboardId, actor, 'read');
  }

  @Get(':id/views')
  listViews(@Param('id') id: string, @Req() req) {
    return this.views.list(this.access.id(id), req.user.accessKeyData.id);
  }
  @Post(':id/views')
  createView(@Param('id') id: string, @Body() body: any, @Req() req) {
    return this.views.create(this.access.id(id), req.user.accessKeyData.id, body);
  }
  @Get(':id/views/:viewId')
  loadView(@Param('id') id: string, @Param('viewId') viewId: string, @Req() req) {
    return this.views.load(this.access.id(id), this.access.id(viewId), req.user.accessKeyData.id);
  }
  @Delete(':id/views/:viewId')
  removeView(@Param('id') id: string, @Param('viewId') viewId: string, @Req() req) {
    return this.views.remove(this.access.id(id), this.access.id(viewId), req.user.accessKeyData.id);
  }

  @Put(':id')
  @ApiBearerAuth('AccessKey')
  async update(
    @Param('id') id: string,
    @Body() updateDashboardDto: UpdateDashboardDto,
    @Req() req,
  ) {
    const actor = req.user.accessKeyData.id;
    const dashboardId = this.access.id(id);
    // UC-051: direct dashboard save uses the explicit edit action; delete stays owner-only.
    await this.access.dashboard(dashboardId, actor, 'edit');
    return this.dashboardService.update(dashboardId, updateDashboardDto, actor, 'edit');
  }
}
