import { JwtService } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { ConnectionModule } from '../connection/connection.module';
import { StudioSampleService } from './studio-sample.service';
import { BiService } from '../bi/bi.service';
import { StudioCreationService } from './studio-creation.service';
import { StudioCreationController } from './studio-creation.controller';
import { StudioRunService } from './studio-run.service';
import { StudioRunController } from './studio-run.controller';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';
import { StudioState } from './entities/studio-state.entity';
import { StudioRun } from './entities/studio-run.entity';
@Module({
  imports: [AiModule, ConnectionModule, TypeOrmModule.forFeature([StudioState, StudioRun])],
  controllers: [StudioController, StudioRunController, StudioCreationController],
  providers: [
    StudioService,
    StudioRunService,
    StudioCreationService,
    StudioSampleService,
    BiService,
    JwtService,
  ],
})
export class StudioModule {}
