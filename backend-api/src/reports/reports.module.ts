import { studioPublicationNoStore } from '../dashboard-studio/studio-publication.controller';
import { JwtService } from '@nestjs/jwt';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudioModule } from '../dashboard-studio/studio.module';
import { reportBodyAiProvider } from './report-ai';
import { CommentNotificationService } from './comment-notification.service';
import { CommentNotificationsController } from './comment-notifications.controller';
import { REPORT_COMMENT_ENTITIES } from './report-comment.entity';
import { ReportCommentService } from './report-comment.service';
import { ReportCommentsController } from './report-comments.controller';
import { REPORT_SHARING_ENTITIES } from './report-sharing.entity';
import { ReportSharingService } from './report-sharing.service';
import { REPORT_ENTITIES } from './report.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
@Module({
  imports: [
    StudioModule,
    TypeOrmModule.forFeature([
      ...REPORT_ENTITIES,
      ...REPORT_SHARING_ENTITIES,
      ...REPORT_COMMENT_ENTITIES,
    ]),
  ],
  controllers: [ReportsController, ReportCommentsController, CommentNotificationsController],
  providers: [
    ReportsService,
    ReportSharingService,
    ReportCommentService,
    CommentNotificationService,
    JwtService,
    reportBodyAiProvider,
  ],
  exports: [ReportSharingService, ReportCommentService],
})
export class ReportsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(studioPublicationNoStore).forRoutes(
      ReportsController,
      ReportCommentsController,
      CommentNotificationsController,
    );
  }
}
