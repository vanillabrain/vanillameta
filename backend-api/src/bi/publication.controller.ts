import { Body, Controller, Get, Header, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicationService } from './publication.service';

function success(data: any) {
  return { status: 'SUCCESS', data };
}

@UseGuards(JwtAuthGuard)
@Controller('bi/dashboards/:id/publication')
export class PublicationController {
  constructor(private readonly publication: PublicationService) {}

  private actor(req: any) {
    return req.user?.accessKeyData?.id;
  }

  @Get() @Header('Cache-Control', 'no-store') async state(@Param('id') id: string, @Req() req) {
    return success(await this.publication.state(id, this.actor(req)));
  }

  @Post('preview') async preview(@Param('id') id: string, @Body() body: any, @Req() req) {
    return success(await this.publication.preview(id, this.actor(req), body));
  }

  @Post('revoke') async revoke(@Param('id') id: string, @Body() body: any, @Req() req) {
    return success(await this.publication.revoke(id, this.actor(req), body));
  }

  @Post() async publish(@Param('id') id: string, @Body() body: any, @Req() req) {
    return success(await this.publication.publish(id, this.actor(req), body));
  }
}

/** Anonymous read; the snapshot is served without a token and never runs a source query. */
@Controller('publications')
export class PublishedPublicationController {
  constructor(private readonly publication: PublicationService) {}

  @Get(':uuid') @Header('Cache-Control', 'no-store') async read(@Param('uuid') uuid: string) {
    return success(await this.publication.publicResult(uuid));
  }
}
