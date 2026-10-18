import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardLifecycleService } from './dashboard-lifecycle.service';

@UseGuards(JwtAuthGuard)
@Controller('enterprise/resources/dashboard')
export class DashboardLifecycleController {
  constructor(private readonly lifecycle: DashboardLifecycleService) {}
  @Get(':id/lifecycle')
  @Header('Cache-Control', 'no-store')
  read(@Param('id') id: string, @Req() req: any) {
    return this.lifecycle.read(
      id,
      req.user.accessKeyData.id,
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
  @Post(':id/lifecycle')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  set(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    return this.lifecycle.set(
      id,
      req.user.accessKeyData.id,
      body,
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
}
