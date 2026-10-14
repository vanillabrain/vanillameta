import { Dashboard } from '../dashboard/entities/dashboard.entity';
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
  imports: [AiModule, ConnectionModule, TypeOrmModule.forFeature([PersonalView, Dashboard])],
  controllers: [
    BiController,
    SemanticProposalController,
    BiExploreController,
    ExploreViewController,
    DashboardPivotController,
    BiExploreViewsController,
  ],
  providers: [
    BiService,
    SemanticProposalService,
    BiExploreService,
    ExploreViewService,
    DashboardPivotService,
    VersionedExploreViewService,
    JwtService,
  ],
})
export class BiModule {}
