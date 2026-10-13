import { JwtService } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConnectionModule } from '../connection/connection.module';
import { BiController } from './bi.controller';
import { BiExploreController } from './bi-explore.controller';
import { BiExploreService } from './bi-explore.service';
import { BiService } from './bi.service';
@Module({
  imports: [AiModule, ConnectionModule],
  controllers: [BiController, BiExploreController],
  providers: [BiService, BiExploreService, JwtService],
})
export class BiModule {}
