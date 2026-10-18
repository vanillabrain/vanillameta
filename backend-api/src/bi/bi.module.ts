import { SourceConditionsController } from './source-conditions.controller';
import { SourceConditionsService } from './source-conditions.service';
import { SourceConditionEntry } from './entities/source-condition-entry.entity';
import { SourceCatalogUsageService } from './source-catalog-usage.service';
import { SourceCatalogController } from './source-catalog.controller';
import { SourceCatalogService } from './source-catalog.service';
import { SourceCatalogEntry } from './entities/source-catalog-entry.entity';
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
import { BiService } from './bi.service';
@Module({
  imports: [
    AiModule,
    ConnectionModule,
    TypeOrmModule.forFeature([
      PersonalView,
      Dashboard,
      DashboardPublication,
      SourceCatalogEntry,
      SourceConditionEntry,
    ]),
  ],
  controllers: [
    SourceConditionsController,
    SourceCatalogController,
    BiController,
    DashboardReuseController,
    SharedReuseController,
    ReuseLinkController,
    ReuseAccessController,
    SemanticProposalController,
    BiExploreController,
    ExploreViewController,
    DashboardPivotController,
    BiExploreViewsController,
    PublicationController,
    PublishedPublicationController,
  ],
  providers: [
    SourceConditionsService,
    SourceCatalogService,
    SourceCatalogUsageService,
    BiService,
    DashboardReuseService,
    SharedReuseOriginService,
    SemanticProposalService,
    SemanticCreationService,
    BiExploreService,
    ExploreViewService,
    DashboardPivotService,
    VersionedExploreViewService,
    PublicationService,
    JwtService,
  ],
})
export class BiModule {}
