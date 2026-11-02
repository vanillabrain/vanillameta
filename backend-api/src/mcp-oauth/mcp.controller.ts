import { All, Controller, Get, Header, Module, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpOAuthService } from './mcp-oauth.service';
import { MCP_SCOPES, mcpAuthorizationMetadata, readMcpConfig } from './config';
import { McpReadService } from './mcp-read.service';
import { McpReportService } from './mcp-report.service';
import { buildMcpServer } from './mcp-server';
import { McpOAuthModule } from './mcp-oauth.module';
import { BiModule } from '../bi/bi.module';
import { DocumentsModule } from '../documents/documents.module';
import { ReportsModule } from '../reports/reports.module';

export function authorizationMetadata() {
  const c = readMcpConfig();
  return c ? mcpAuthorizationMetadata(c) : null;
}
@Controller('.well-known')
export class McpMetadataController {
  @Get('oauth-authorization-server/v1/mcp-oauth')
  @Header('Cache-Control', 'no-store')
  authorization(@Res() res: Response) {
    const value = authorizationMetadata();
    return res.status(value ? 200 : 503).json(value ?? { error: 'temporarily_unavailable' });
  }
  @Get('oauth-protected-resource/v1/mcp') @Header('Cache-Control', 'no-store') resource(
    @Res() res: Response,
  ) {
    const c = readMcpConfig();
    return res.status(c ? 200 : 503).json(
      c
        ? {
            resource: c.resource,
            authorization_servers: [c.issuer],
            scopes_supported: [...MCP_SCOPES],
            bearer_methods_supported: ['header'],
          }
        : { error: 'temporarily_unavailable' },
    );
  }
}

@Controller('mcp')
export class McpController {
  constructor(
    private readonly auth: McpOAuthService,
    private readonly read: McpReadService,
    private readonly reports: McpReportService,
  ) {}
  @All() async handle(@Req() req: Request, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const c = readMcpConfig();
    if (!c) return res.status(503).json({ error: 'temporarily_unavailable' });
    if (
      req.headers.host !== new URL(c.apiBase).host ||
      (req.headers.origin && req.headers.origin !== new URL(c.webBase).origin)
    )
      return res.status(403).json({ error: 'access_denied' });
    let principal: Awaited<ReturnType<McpOAuthService['authenticateBearer']>>;
    try {
      principal = await this.auth.authenticateBearer(req.headers.authorization ?? '');
    } catch {
      res.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata="${
          new URL(c.apiBase).origin
        }/.well-known/oauth-protected-resource/v1/mcp"`,
      );
      return res.status(401).json({ error: 'invalid_token' });
    }
    const server = buildMcpServer(principal, {
      auth: this.auth,
      read: this.read,
      reports: this.reports,
    });
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } finally {
      await server.close();
    }
  }
}

/**
 * Report services come from ReportsModule, whose ReportsService holds the server AI provider. No MCP
 * tool reaches it: McpReportService uses only ReportSharingService and ReportCommentService, which
 * never call ReportsService.suggest (mcp-server.spec checks the provider is never called).
 */
@Module({
  imports: [McpOAuthModule, BiModule, DocumentsModule, ReportsModule],
  controllers: [McpController, McpMetadataController],
  providers: [McpReadService, McpReportService],
})
export class McpRemoteModule {}
