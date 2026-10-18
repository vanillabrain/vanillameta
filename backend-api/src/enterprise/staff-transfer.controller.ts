import { Body, Controller, Delete, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffTransferService } from './staff-transfer.service';
@Controller('enterprise/staff-transfer')
@UseGuards(JwtAuthGuard)
export class StaffTransferController {
  constructor(private readonly service: StaffTransferService) {}
  @Get() async status(@Req() r: any, @Res() response: any) {
    const a = r.user.accessKeyData;
    // Nest otherwise serializes null as an empty response, which is not the JSON contract.
    return response.status(200).json(await this.service.status(a.id, a.authVersion ?? 0));
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
