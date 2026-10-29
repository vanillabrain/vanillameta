import {
  ArgumentsHost,
  CanActivate,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import OAuth2Server = require('@node-oauth/oauth2-server');
import { Request, Response } from 'express';
import { z } from 'zod';
import { readMcpConfig } from './config';
import { McpOAuthActor } from './mcp-oauth.service';

export const MCP_CONSENT_COOKIE = 'vm_mcp_consent';

function checkHttp(context: ExecutionContext, consent: boolean) {
  const request = context.switchToHttp().getRequest<Request>();
  const response = context.switchToHttp().getResponse<Response>();
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Referrer-Policy', 'no-referrer');
  const config = readMcpConfig();
  if (!config) return true;
  const api = new URL(config.apiBase);
  const origin = request.headers.origin;
  if (
    request.headers.host !== api.host ||
    (origin !== undefined && origin !== (consent ? config.webBase : api.origin))
  )
    throw new ForbiddenException('Request origin rejected.');
  return true;
}

@Injectable()
export class McpPublicHttpGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    return checkHttp(context, false);
  }
}

@Injectable()
export class McpConsentHttpGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    return checkHttp(context, true);
  }
}

export function consentBrowser(request: Request): string {
  const cookies = (request.headers.cookie ?? '')
    .split(';')
    .map(cookie => cookie.trim())
    .filter(cookie => cookie.startsWith(`${MCP_CONSENT_COOKIE}=`));
  return cookies.length === 1 ? cookies[0].slice(MCP_CONSENT_COOKIE.length + 1) : '';
}

export function consentActor(request: Request): McpOAuthActor {
  const parsed = z
    .object({
      accessKeyData: z.object({
        id: z.number().int().positive(),
        authVersion: z.number().int().nonnegative().default(0),
      }),
    })
    .safeParse(request.user);
  if (!parsed.success || !request.headers.authorization?.startsWith('Bearer '))
    throw new UnauthorizedException('Authorization unavailable.');
  return {
    actorId: parsed.data.accessKeyData.id,
    authVersion: parsed.data.accessKeyData.authVersion,
  };
}

export function requireForm(request: Request) {
  if (
    !request.is('application/x-www-form-urlencoded') ||
    request.headers.authorization ||
    Object.keys(request.query).length
  )
    throw new OAuth2Server.InvalidRequestError('Invalid form request.');
}

@Catch()
export class McpOAuthExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    const allowed = new Set([
      'invalid_request',
      'invalid_client',
      'invalid_grant',
      'invalid_scope',
      'unauthorized_client',
      'unsupported_grant_type',
      'unsupported_response_type',
      'access_denied',
    ]);
    if (error instanceof OAuth2Server.OAuthError) {
      const name = allowed.has(error.name) ? error.name : 'server_error';
      response
        .status(name === 'server_error' ? 500 : 400)
        .json({ error: name, error_description: 'Request rejected.' });
      return;
    }
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (
      status === 401 &&
      error instanceof HttpException &&
      error.getResponse() === 'accessTokenExpired'
    ) {
      response.status(401).json({ message: 'accessTokenExpired' });
      return;
    }
    response.status(status).json({
      error: status >= 500 ? 'temporarily_unavailable' : 'invalid_request',
      message: 'Request rejected.',
    });
  }
}
