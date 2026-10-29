import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  consentActor,
  consentBrowser,
  McpConsentHttpGuard,
  McpOAuthExceptionFilter,
} from './mcp-oauth.http';
import { McpOAuthService } from './mcp-oauth.service';

@Controller('ai-connections')
@UseGuards(McpConsentHttpGuard, JwtAuthGuard)
@UseFilters(McpOAuthExceptionFilter)
export class AiConnectionsController {
  constructor(private readonly service: McpOAuthService) {}

  @Get()
  connections(@Req() request: Request) {
    return this.service.connections(consentActor(request));
  }

  @Get('requests/:ticket')
  request(@Param('ticket') ticket: string, @Req() request: Request) {
    return this.service.request(consentActor(request), ticket, consentBrowser(request));
  }

  @Post('requests/:ticket/decision')
  @HttpCode(200)
  decision(@Param('ticket') ticket: string, @Body() body: unknown, @Req() request: Request) {
    return this.service.decision(consentActor(request), ticket, consentBrowser(request), body);
  }

  @Post(':id/disconnect')
  @HttpCode(200)
  disconnect(@Param('id') id: string, @Body() body: unknown, @Req() request: Request) {
    return this.service.disconnect(consentActor(request), id, body);
  }
}
