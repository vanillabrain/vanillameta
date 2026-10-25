import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import { StudioPublicationGuard } from './studio-publication.controller';
import { StudioRemixService } from './studio-remix.service';
import { RemixPreviewRequest, RemixRequest } from './studio-remix-contract';
@UseGuards(StudioPublicationGuard, UserThrottleGuard)
@Controller('studio/publications')
export class StudioRemixController {
  constructor(private readonly remixService: StudioRemixService) {}
  @UserThrottle('read')
  @Get(':token/remix-template')
  template(@Param('token') token: string, @Req() req) {
    return this.remixService.template(token, req.user?.accessKeyData?.id);
  }
  @UserThrottle('remix')
  @Post(':token/remix-preview')
  preview(@Param('token') token: string, @Body() body: RemixPreviewRequest, @Req() req) {
    return this.remixService.preview(
      token,
      body,
      req.user?.accessKeyData?.id,
      undefined,
      req.user?.accessKeyData?.authVersion ?? 0,
    );
  }
  @UserThrottle('remix')
  @Post(':token/remix')
  remix(@Param('token') token: string, @Body() body: RemixRequest, @Req() req) {
    return this.remixService.remix(
      token,
      body,
      req.user?.accessKeyData?.id,
      undefined,
      req.user?.accessKeyData?.authVersion ?? 0,
    );
  }
}
