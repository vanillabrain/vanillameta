import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { StudioPublicationGuard } from './studio-publication.controller';
import { StudioRemixService } from './studio-remix.service';
import { RemixPreviewRequest, RemixRequest } from './studio-remix-contract';
@UseGuards(StudioPublicationGuard)
@Controller('studio/publications')
export class StudioRemixController {
  constructor(private readonly remixService: StudioRemixService) {}
  @Get(':token/remix-template') template(@Param('token') token: string, @Req() req) {
    return this.remixService.template(token, req.user?.accessKeyData?.id);
  }
  @Post(':token/remix-preview') preview(
    @Param('token') token: string,
    @Body() body: RemixPreviewRequest,
    @Req() req,
  ) {
    return this.remixService.preview(token, body, req.user?.accessKeyData?.id);
  }
  @Post(':token/remix') remix(
    @Param('token') token: string,
    @Body() body: RemixRequest,
    @Req() req,
  ) {
    return this.remixService.remix(token, body, req.user?.accessKeyData?.id);
  }
}
