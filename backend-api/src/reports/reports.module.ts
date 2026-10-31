import { studioPublicationNoStore } from '../dashboard-studio/studio-publication.controller';
import { JwtService } from '@nestjs/jwt';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudioModule } from '../dashboard-studio/studio.module';
import { reportBodyAiProvider } from './report-ai';
import { REPORT_SHARING_ENTITIES } from './report-sharing.entity';
import { ReportSharingService } from './report-sharing.service';
import { REPORT_ENTITIES } from './report.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
@Module({
  imports: [
    StudioModule,
    TypeOrmModule.forFeature([...REPORT_ENTITIES, ...REPORT_SHARING_ENTITIES]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportSharingService, JwtService, reportBodyAiProvider],
})
export class ReportsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(studioPublicationNoStore).forRoutes(ReportsController);
  }
}
