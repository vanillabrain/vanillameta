import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiArtifact } from './ai-artifact.entity';
import { AiArtifactsController } from './ai-artifacts.controller';
import { AiArtifactsService } from './ai-artifacts.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiArtifact])],
  controllers: [AiArtifactsController],
  providers: [AiArtifactsService, JwtService],
  exports: [AiArtifactsService],
})
export class AiArtifactsModule {}
