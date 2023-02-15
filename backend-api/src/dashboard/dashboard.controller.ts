import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('AccessKey')
  create(@Body() createDashboardDto: CreateDashboardDto, @Req() req) {
    const { accessKeyData } = req.user;
    console.log('asdf', accessKeyData)
    return this.dashboardService.create(createDashboardDto, accessKeyData.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('AccessKey')
  findAll(@Req() req) {
    const { accessKeyData } = req.user;
    return this.dashboardService.findAll(accessKeyData.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('AccessKey')
  findOne(@Param('id') id: string) {
    return this.dashboardService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('AccessKey')
  update(@Param('id') id: string, @Body() updateDashboardDto: UpdateDashboardDto) {
    return this.dashboardService.update(+id, updateDashboardDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('AccessKey')
  remove(@Param('id') id: string) {
    return this.dashboardService.remove(+id);
  }
}
