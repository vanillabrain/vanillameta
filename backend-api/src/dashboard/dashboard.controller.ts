import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post()
  @ApiBearerAuth('AccessKey')
  create(@Body() createDashboardDto: CreateDashboardDto, @Req() req) {
    const { accessKeyData } = req.user;
    return this.dashboardService.create(createDashboardDto, accessKeyData.id);
  }

  @Get()
  @ApiBearerAuth('AccessKey')
  findAll(@Req() req) {
    const { accessKeyData } = req.user;
    return this.dashboardService.findAll(accessKeyData.id);
  }

  @Get(':id')
  @ApiBearerAuth('AccessKey')
  findOne(@Param('id') id: string, @Req() req) {
    return this.dashboardService.findOne(+id, req.user.accessKeyData.id);
  }

  @Put(':id')
  @ApiBearerAuth('AccessKey')
  update(@Param('id') id: string, @Body() updateDashboardDto: UpdateDashboardDto, @Req() req) {
    return this.dashboardService.update(+id, updateDashboardDto, req.user.accessKeyData.id);
  }

  @Delete(':id')
  @ApiBearerAuth('AccessKey')
  remove(@Param('id') id: string, @Req() req) {
    return this.dashboardService.remove(+id, req.user.accessKeyData.id);
  }
}
