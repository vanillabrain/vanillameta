import { ConditionReport, ConditionReportOccurrence } from './condition-report.entity';
import { ConditionReportService } from './condition-report.service';
import { ConditionReportController } from './condition-report.controller';
import { FileSchemaImpactService } from './file-schema-impact.service';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';
import {
  BiOrganization,
  BiOrganizationGroup,
  BiOrganizationMember,
  BiDashboardPolicy,
  BiPolicyAudit,
} from './governance.entity';
import { FileSchemaDiagnosisService } from './file-schema-diagnosis.service';
import { SourceModelService } from './source-model.service';
import { SourceModelController } from './source-model.controller';
import { SourceModelReceipt } from './source-model-receipt.entity';
import { FileSchemaImpactController } from './file-schema-impact.controller';
import { SharedReuseOriginService } from './shared-reuse-origin.service';
import {
  SharedReuseController,
  ReuseLinkController,
  ReuseAccessController,
} from './shared-reuse.controller';
import { DashboardReuseService } from './dashboard-reuse.service';
import { DashboardReuseController } from './dashboard-reuse.controller';
import { SemanticCreationService } from './semantic-creation.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { PublicationService } from './publication.service';
import { PublicationController, PublishedPublicationController } from './publication.controller';
import { DashboardPivotService } from './dashboard-pivot.service';
import { DashboardPivotController } from './dashboard-pivot.controller';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { ExploreViewController } from './explore-view.controller';
import { ExploreViewService } from './explore-view.service';
import { SemanticProposalService } from './semantic-proposal.service';
import { SemanticProposalController } from './semantic-proposal.controller';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConnectionModule } from '../connection/connection.module';
import { BiController } from './bi.controller';
import { BiExploreController } from './bi-explore.controller';
import { VersionedExploreViewService } from './versioned-explore-view.service';
import { BiExploreViewsController } from './bi-explore-views.controller';
import { BiExploreService } from './bi-explore.service';
import { BiSegmentController } from './bi-segment.controller';
import { BiSegmentService } from './bi-segment.service';
import { BiSeriesController } from './bi-series.controller';
import { BiSeriesService } from './bi-series.service';
import { BiService } from './bi.service';
@Module({
  imports: [
    AiModule,
    ConnectionModule,
    TypeOrmModule.forFeature([
      PersonalView,
      Dashboard,
      DashboardPublication,
      SourceModelReceipt,
      ConditionReport,
      ConditionReportOccurrence,
      BiOrganization,
      BiOrganizationGroup,
      BiOrganizationMember,
      BiDashboardPolicy,
      BiPolicyAudit,
    ]),
  ],
  controllers: [
    ConditionReportController,
    GovernanceController,
    SourceModelController,
    FileSchemaImpactController,
    BiController,
    DashboardReuseController,
    SharedReuseController,
    ReuseLinkController,
    ReuseAccessController,
    SemanticProposalController,
    BiExploreController,
    BiSegmentController,
    BiSeriesController,
    ExploreViewController,
    DashboardPivotController,
    BiExploreViewsController,
    PublicationController,
    PublishedPublicationController,
  ],
  providers: [
    ConditionReportService,
    GovernanceService,
    SourceModelService,
    FileSchemaImpactService,
    FileSchemaDiagnosisService,
    BiService,
    DashboardReuseService,
    SharedReuseOriginService,
    SemanticProposalService,
    SemanticCreationService,
    BiExploreService,
    BiSegmentService,
    BiSeriesService,
    ExploreViewService,
    DashboardPivotService,
    VersionedExploreViewService,
    PublicationService,
    JwtService,
  ],
})
export class BiModule {}
