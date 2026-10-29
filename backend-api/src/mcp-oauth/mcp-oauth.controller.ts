import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  consentBrowser,
  MCP_CONSENT_COOKIE,
  McpOAuthExceptionFilter,
  McpPublicHttpGuard,
  requireForm,
} from './mcp-oauth.http';
import { McpOAuthService } from './mcp-oauth.service';

@Controller('mcp-oauth')
@UseGuards(McpPublicHttpGuard)
@UseFilters(McpOAuthExceptionFilter)
export class McpOAuthController {
  constructor(private readonly service: McpOAuthService) {}

  @Get('.well-known/oauth-authorization-server')
  metadata() {
    return this.service.authorizationMetadata();
  }

  @Get('authorize')
  async authorize(@Query() query: unknown, @Req() request: Request, @Res() response: Response) {
    const result = await this.service.authorize(query, consentBrowser(request));
    response.cookie(MCP_CONSENT_COOKIE, result.browser, {
      httpOnly: true,
      sameSite: 'lax',
      secure: result.secure,
      path: '/',
      maxAge: 5 * 60_000,
    });
    response.redirect(302, result.redirectUrl);
  }

  @Post('token')
  @HttpCode(200)
  token(@Body() body: unknown, @Req() request: Request) {
    requireForm(request);
    return this.service.token(body);
  }

  @Post('revoke')
  @HttpCode(200)
  revoke(@Body() body: unknown, @Req() request: Request) {
    requireForm(request);
    return this.service.revoke(body);
  }
}
