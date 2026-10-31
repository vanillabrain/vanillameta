import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { DOCUMENT_ENTITIES } from './document.entity';
import { GoogleDocsProvider } from './google-docs.provider';
import { documentSummaryAiProvider } from './document-ai';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...DOCUMENT_ENTITIES,
      User,
      EnterpriseMembership,
      EnterpriseOrganization,
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, GoogleDocsProvider, JwtService, documentSummaryAiProvider],
  exports: [DocumentsService],
})
export class DocumentsModule {}
