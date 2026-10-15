import {
  Body,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudioPublicationService } from './studio-publication.service';

export function studioPublicationNoStore(req, res, next) {
  void req;
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
}
/** Set headers before pipes/auth so unauthorized, expired and malformed responses also prohibit caching. */
@Injectable()
export class StudioPublicationGuard extends JwtAuthGuard {
  constructor(jwt: JwtService, db: DataSource) {
    super(jwt, db);
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp(),
      req = http.getRequest(),
      res = http.getResponse();
    studioPublicationNoStore(req, res, () => undefined);
    // Only the exact publication read endpoint is optional-auth, never the owner metadata endpoint.
    if (
      req.method === 'GET' &&
      /(?:^|\/)publications\/:token$/.test(req.route?.path ?? '') &&
      req.headers.authorization === undefined
    )
      return true;
    return super.canActivate(context);
  }
}
@UseGuards(StudioPublicationGuard)
@Controller('studio')
export class StudioPublicationController {
  constructor(private readonly publications: StudioPublicationService) {}
  @Post('dashboards/:id/publications')
  publish(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Req() req) {
    return this.publications.publish(id, body, req.user?.accessKeyData?.id);
  }
  @Get('dashboards/:id/publications')
  owner(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.publications.ownerMetadata(id, req.user?.accessKeyData?.id);
  }
  @Get('publications/:token')
  read(@Param('token') token: string, @Req() req) {
    return this.publications.read(token, req.user?.accessKeyData?.id);
  }
  @Post('publications/:token/revoke')
  revoke(@Param('token') token: string, @Req() req) {
    return this.publications.revoke(token, req.user?.accessKeyData?.id);
  }
}
