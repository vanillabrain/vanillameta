import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiArtifact } from './ai-artifact.entity';
import { AiArtifactsController } from './ai-artifacts.controller';
import { AiArtifactsService } from './ai-artifacts.service';

import { AiArtifactSharingService } from './ai-artifact-sharing.service';
import { AiArtifactShare } from './ai-artifact-share.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiArtifact, AiArtifactShare])],
  controllers: [AiArtifactsController],
  providers: [AiArtifactsService, AiArtifactSharingService, JwtService],
  exports: [AiArtifactsService],
})
export class AiArtifactsModule {}
