import { JwtService } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConnectionModule } from '../connection/connection.module';
import { BiController } from './bi.controller';
import { BiExploreController } from './bi-explore.controller';
import { BiExploreViewsController } from './bi-explore-views.controller';
import { BiExploreService } from './bi-explore.service';
import { ExploreViewService } from './explore-view.service';
import { BiService } from './bi.service';
@Module({
  imports: [AiModule, ConnectionModule],
  controllers: [BiController, BiExploreController, BiExploreViewsController],
  providers: [BiService, BiExploreService, ExploreViewService, JwtService],
})
export class BiModule {}
