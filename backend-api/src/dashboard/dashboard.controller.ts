import { SourceAccessService } from '../ownership/source-access.service';
import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';
import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, SourceOwnershipGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly access: SourceAccessService,
  ) {}

  @Post()
  @ApiBearerAuth('AccessKey')
  create(@Body() createDashboardDto: CreateDashboardDto, @Req() req) {
    const { accessKeyData } = req.user;
    return this.dashboardService.create(createDashboardDto, accessKeyData.id);
  }

  @Get()
  @ApiBearerAuth('AccessKey')
  async findAll(@Req() req) {
    const { accessKeyData } = req.user;
    return this.access.filterResults(
      'dashboard',
      accessKeyData.id,
      await this.dashboardService.findAll(accessKeyData.id),
    );
  }

  @Get(':id')
  @ApiBearerAuth('AccessKey')
  async findOne(@Param('id') id: string, @Req() req) {
    return this.dashboardService.findOne(+id, req.user.accessKeyData.id);
  }

  @Put(':id')
  @ApiBearerAuth('AccessKey')
  async update(
    @Param('id') id: string,
    @Body() updateDashboardDto: UpdateDashboardDto,
    @Req() req,
  ) {
    await this.dashboardService.assertOwner(+id, req.user.accessKeyData.id);
    return this.dashboardService.update(+id, updateDashboardDto);
  }

  @Delete(':id')
  @ApiBearerAuth('AccessKey')
  async remove(@Param('id') id: string, @Req() req) {
    await this.dashboardService.assertOwner(+id, req.user.accessKeyData.id);
    return this.dashboardService.remove(+id);
  }
}
