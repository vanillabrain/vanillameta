import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ARTIFACT_ENTITIES } from './artifact.entity';
import { ArtifactsController, ArtifactSharedController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';

@Module({
  imports: [TypeOrmModule.forFeature(ARTIFACT_ENTITIES)],
  controllers: [ArtifactsController, ArtifactSharedController],
  providers: [ArtifactsService, JwtService],
})
export class ArtifactsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        next();
      })
      .forRoutes(ArtifactsController, ArtifactSharedController);
  }
}
