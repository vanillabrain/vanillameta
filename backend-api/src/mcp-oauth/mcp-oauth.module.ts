import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { User } from '../user/entities/user.entity';
import { AiConnectionsController } from './ai-connections.controller';
import { McpOAuthController } from './mcp-oauth.controller';
import { MCP_OAUTH_ENTITIES } from './mcp-oauth.entities';
import { McpConsentHttpGuard, McpPublicHttpGuard } from './mcp-oauth.http';
import { McpOAuthService } from './mcp-oauth.service';

@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      ...MCP_OAUTH_ENTITIES,
      User,
      EnterpriseMembership,
      EnterpriseOrganization,
    ]),
  ],
  controllers: [McpOAuthController, AiConnectionsController],
  providers: [McpOAuthService, JwtAuthGuard, McpConsentHttpGuard, McpPublicHttpGuard],
  exports: [McpOAuthService],
})
export class McpOAuthModule {}
