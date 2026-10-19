import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffDepartureService } from './staff-departure.service';
@Controller('enterprise/staff-departure')
@UseGuards(JwtAuthGuard)
export class StaffDepartureController {
  constructor(private readonly service: StaffDepartureService) {}
  @Post() request(@Req() r: any, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.request(a.id, a.authVersion ?? 0, body);
  }
  @Get(':id') get(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.get(a.id, a.authVersion ?? 0, id);
  }
  @Get(':id/review') review(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.review(a.id, a.authVersion ?? 0, id);
  }
  @Post(':id/complete') complete(@Req() r: any, @Param('id') id: string, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.complete(a.id, a.authVersion ?? 0, id, body);
  }
  @Post(':id/cancel') cancel(@Req() r: any, @Param('id') id: string, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.cancel(a.id, a.authVersion ?? 0, id, body);
  }
}
