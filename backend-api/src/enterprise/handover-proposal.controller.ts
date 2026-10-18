import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HandoverProposalService } from './handover-proposal.service';
@Controller('enterprise/handover')
@UseGuards(JwtAuthGuard)
export class HandoverProposalController {
  constructor(private readonly service: HandoverProposalService) {}
  @Get('candidates') candidates(
    @Req() r: any,
    @Query('kind') kind: unknown,
    @Query('afterId') afterId: unknown,
  ) {
    const a = r.user.accessKeyData;
    return this.service.candidates(a.id, a.authVersion ?? 0, kind, afterId);
  }
  @Post() create(@Req() r: any, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.create(a.id, a.authVersion ?? 0, body);
  }
  @Get(':id') detail(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.detail(id, a.id, a.authVersion ?? 0);
  }
  @Get(':id/dependencies') dependencies(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.dependencies(id, a.id, a.authVersion ?? 0);
  }
  @Get(':id/custody') custody(@Req() r: any, @Param('id') id: string) {
    const a = r.user.accessKeyData;
    return this.service.custody(id, a.id, a.authVersion ?? 0);
  }
  @Post(':id/accept') accept(@Req() r: any, @Param('id') id: string, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.accept(id, a.id, a.authVersion ?? 0, body);
  }
  @Post(':id/cancel') cancel(@Req() r: any, @Param('id') id: string, @Body() body: unknown) {
    const a = r.user.accessKeyData;
    return this.service.cancel(id, a.id, a.authVersion ?? 0, body);
  }
}
