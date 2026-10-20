import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SourceHandoverService } from './source-handover.service';
@Controller('enterprise/handover')
@UseGuards(JwtAuthGuard)
export class SourceHandoverController {
  constructor(private readonly service: SourceHandoverService) {}
  @Get(':id/source-transfer-review') review(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.review(id, a.id, a.authVersion ?? 0);
  }
  @Get(':id/source-transfer') detail(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.detail(id, a.id, a.authVersion ?? 0);
  }
  @Post(':id/source-transfer') prepare(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.prepare(id, a.id, a.authVersion ?? 0, body);
  }
  @Post(':id/source-transfer/accept') accept(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.change(id, a.id, a.authVersion ?? 0, body, 'accept');
  }
  @Post(':id/source-transfer/execute') execute(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.change(id, a.id, a.authVersion ?? 0, body, 'execute');
  }
  @Post(':id/source-transfer/cancel') cancel(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.change(id, a.id, a.authVersion ?? 0, body, 'cancel');
  }
}
