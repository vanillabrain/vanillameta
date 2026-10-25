import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import { StudioPublicationGuard } from './studio-publication.controller';
import { StudioReceivedRemixService } from './studio-received-remix.service';
import { StudioRemixService } from './studio-remix.service';
import { RemixPreviewRequest, RemixRequest } from './studio-remix-contract';
@UseGuards(StudioPublicationGuard, UserThrottleGuard)
@Controller('studio/received')
export class StudioReceivedRemixController {
  constructor(
    private readonly received: StudioReceivedRemixService,
    private readonly remix: StudioRemixService,
  ) {}
  @Get(':id/remix-reference') reference(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.received.reference(id, req.user?.accessKeyData?.id);
  }
  @UserThrottle('read')
  @Get(':reference/remix-template') template(@Param('reference') reference: string, @Req() req) {
    return this.remix.template(reference, req.user?.accessKeyData?.id, this.received.resolve);
  }
  @UserThrottle('remix')
  @Post(':reference/remix-preview') preview(
    @Param('reference') reference: string,
    @Body() body: RemixPreviewRequest,
    @Req() req,
  ) {
    return this.remix.preview(
      reference,
      body,
      req.user?.accessKeyData?.id,
      this.received.resolve,
      req.user?.accessKeyData?.authVersion ?? 0,
    );
  }
  @Post(':reference/remix-result') result(
    @Param('reference') reference: string,
    @Body() body: RemixRequest,
    @Req() req,
  ) {
    return this.remix.receivedResult(
      reference,
      body,
      req.user?.accessKeyData?.id,
      req.user?.accessKeyData?.authVersion ?? 0,
    );
  }
  @UserThrottle('remix')
  @Post(':reference/remix') save(
    @Param('reference') reference: string,
    @Body() body: RemixRequest,
    @Req() req,
  ) {
    return this.remix.remix(
      reference,
      body,
      req.user?.accessKeyData?.id,
      this.received.resolve,
      req.user?.accessKeyData?.authVersion ?? 0,
    );
  }
}
