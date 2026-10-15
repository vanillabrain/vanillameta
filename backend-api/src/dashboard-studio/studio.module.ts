import { JwtService } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { ConnectionModule } from '../connection/connection.module';
import { StudioRunService } from './studio-run.service';
import { StudioRunController } from './studio-run.controller';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';
import { StudioState } from './entities/studio-state.entity';
import { StudioRun } from './entities/studio-run.entity';
@Module({
  imports: [AiModule, ConnectionModule, TypeOrmModule.forFeature([StudioState, StudioRun])],
  controllers: [StudioController, StudioRunController],
  providers: [StudioService, StudioRunService, JwtService],
})
export class StudioModule {}
