import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../enterprise/entities/enterprise-organization.entity';
import { DOCUMENT_ENTITIES } from './document.entity';
import { GoogleDocsProvider } from './google-docs.provider';
import { documentSummaryAiProvider } from './document-ai';
import { MicrosoftDocsProvider } from './microsoft-docs.provider';
import { GoogleSheetsProvider } from './google-sheets.provider';
import { DatabaseModule } from '../database/database.module';
import { SheetsController } from './sheets.controller';
import { SheetsSourceService } from './sheets-source.service';
import { MicrosoftSourceService } from './microsoft-source.service';
import { MicrosoftController } from './microsoft.controller';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      ...DOCUMENT_ENTITIES,
      User,
      EnterpriseMembership,
      EnterpriseOrganization,
    ]),
  ],
  controllers: [DocumentsController, SheetsController, MicrosoftController],
  providers: [
    DocumentsService,
    GoogleDocsProvider,
    MicrosoftDocsProvider,
    GoogleSheetsProvider,
    SheetsSourceService,
    MicrosoftSourceService,
    JwtService,
    documentSummaryAiProvider,
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
