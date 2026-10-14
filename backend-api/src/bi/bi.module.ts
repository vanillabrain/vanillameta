import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { ExploreViewController } from './explore-view.controller';
import { ExploreViewService } from './explore-view.service';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConnectionModule } from '../connection/connection.module';
import { BiController } from './bi.controller';
import { BiExploreController } from './bi-explore.controller';
import { BiExploreService } from './bi-explore.service';
import { BiService } from './bi.service';
@Module({
  imports: [AiModule, ConnectionModule, TypeOrmModule.forFeature([PersonalView])],
  controllers: [BiController, BiExploreController, ExploreViewController],
  providers: [BiService, BiExploreService, ExploreViewService, JwtService],
})
export class BiModule {}
