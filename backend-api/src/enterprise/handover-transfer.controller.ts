import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HandoverTransferService } from './handover-transfer.service';
@Controller('enterprise/handover')
@UseGuards(JwtAuthGuard)
export class HandoverTransferController {
  constructor(private readonly service: HandoverTransferService) {}
  @Get(':id/transfer-review') review(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.review(id, a.id, a.authVersion ?? 0);
  }
  @Get(':id/transfer') detail(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.detail(id, a.id, a.authVersion ?? 0);
  }
  @Post(':id/transfer') prepare(@Req() r: any, @Param('id') id: string, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.prepare(id, a.id, a.authVersion ?? 0, body);
  }
  @Post(':id/transfer/accept') accept(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.change(id, a.id, a.authVersion ?? 0, body, 'accept');
  }
  @Post(':id/transfer/execute') execute(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.change(id, a.id, a.authVersion ?? 0, body, 'execute');
  }
  @Post(':id/transfer/cancel') cancel(
    @Req() r: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.change(id, a.id, a.authVersion ?? 0, body, 'cancel');
  }
}
