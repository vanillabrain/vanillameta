import { StudioReceivedRemixService } from './studio-received-remix.service';
import { StudioReceivedRemixController } from './studio-received-remix.controller';
import { StudioRemixRequest } from './entities/studio-remix.entity';
import { StudioRemixService } from './studio-remix.service';
import { StudioRemixController } from './studio-remix.controller';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { StudioPublicationService } from './studio-publication.service';
import {
  StudioPublicationController,
  StudioPublicationGuard,
  studioPublicationNoStore,
} from './studio-publication.controller';
import { StudioExecution } from './entities/studio-execution.entity';
import { StudioExecutionService } from './studio-execution.service';
import { StudioExecutionController } from './studio-execution.controller';
import { JwtService } from '@nestjs/jwt';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
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
  imports: [
    AiModule,
    ConnectionModule,
    TypeOrmModule.forFeature([
      StudioState,
      StudioRun,
      StudioExecution,
      StudioPublication,
      StudioPublicationRequest,
      StudioRemixRequest,
    ]),
  ],
  controllers: [
    StudioReceivedRemixController,
    StudioPublicationController,
    StudioRemixController,
    StudioExecutionController,
    StudioController,
    StudioRunController,
    StudioCreationController,
  ],
  providers: [
    StudioReceivedRemixService,
    StudioPublicationService,
    StudioRemixService,
    StudioPublicationGuard,
    StudioService,
    StudioExecutionService,
    StudioRunService,
    StudioCreationService,
    StudioSampleService,
    BiService,
    JwtService,
  ],
})
export class StudioModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Middleware precedes the application's global throttler as well as route guards.
    consumer
      .apply(studioPublicationNoStore)
      .forRoutes(StudioPublicationController, StudioRemixController, StudioReceivedRemixController);
  }
}
