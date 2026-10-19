import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BundleHandoverService } from './bundle-handover.service';
@Controller('enterprise/handover')
@UseGuards(JwtAuthGuard)
export class BundleHandoverController {
  constructor(private readonly service: BundleHandoverService) {}
  @Get(':id/bundle-transfer-review') review(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.review(id, a.id, a.authVersion ?? 0);
  }
  @Get(':id/bundle-transfer') detail(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.detail(id, a.id, a.authVersion ?? 0);
  }
  @Post(':id/bundle-transfer') prepare(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.prepare(id, a.id, a.authVersion ?? 0, body);
  }
  @Post(':id/bundle-transfer/accept') accept(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.change(id, a.id, a.authVersion ?? 0, body, 'accept');
  }
  @Post(':id/bundle-transfer/execute') execute(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.change(id, a.id, a.authVersion ?? 0, body, 'execute');
  }
  @Post(':id/bundle-transfer/cancel') cancel(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.change(id, a.id, a.authVersion ?? 0, body, 'cancel');
  }
}
