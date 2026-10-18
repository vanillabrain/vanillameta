import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffTransferService } from './staff-transfer.service';
@Controller('enterprise/staff-transfer')
@UseGuards(JwtAuthGuard)
export class StaffTransferController {
  constructor(private readonly service: StaffTransferService) {}
  @Get() status(@Req() r: any) {
    const a = r.user.accessKeyData;
    return this.service.status(a.id, a.authVersion ?? 0);
  }
  @Post() request(@Req() r: any, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.request(a.id, a.authVersion ?? 0, body);
  }
  @Delete() revoke(@Req() r: any) {
    const a = r.user.accessKeyData;
    return this.service.revoke(a.id, a.authVersion ?? 0);
  }
  @Post('review')
  review(@Req() r: any, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.review(a.id, a.authVersion ?? 0, body);
  }
  @Post('accept') accept(@Req() r: any, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.accept(a.id, a.authVersion ?? 0, body);
  }
  @Post('complete') complete(@Req() r: any, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.complete(a.id, a.authVersion ?? 0, body);
  }
}
