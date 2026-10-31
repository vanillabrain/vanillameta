import { ArtifactsModule } from './artifacts/artifacts.module';
import { AddFileArtifacts1793440000000 } from './migrations/1793440000000-add-file-artifacts';
import { AddReportDeliveries1793270000000 } from './migrations/1793270000000-add-report-deliveries';
import { ReportsModule } from './reports/reports.module';
import { AddPrivateReports1793260000000 } from './migrations/1793260000000-add-private-reports';
import { DocumentsModule } from './documents/documents.module';
import { McpRemoteModule } from './mcp-oauth/mcp.controller';
import { AddMcpOAuth1793233000000 } from './migrations/1793233000000-add-mcp-oauth';
import { AddDocumentSummary1793520000000 } from './migrations/postgres/1793520000000-add-document-summary';
import { AddDocumentProvider1793530000000 } from './migrations/postgres/1793530000000-add-document-provider';
import { AddDocumentConnections1793232000000 } from './migrations/1793232000000-add-document-connections';
import { AddStaffDeparture1792620200000 } from './migrations/1792620200000-add-staff-departure';
import { AddBundleHandover1792620100000 } from './migrations/1792620100000-add-bundle-handover';
import { AddSourceHandover1792620000000 } from './migrations/1792620000000-add-source-handover';
import { AddHandoverTransfer1792610000000 } from './migrations/1792610000000-add-handover-transfer';
import { AddHandoverProposal1792600000000 } from './migrations/1792600000000-add-handover-proposal';
import { AddStaffTransfer1792590000000 } from './migrations/1792590000000-add-staff-transfer';
import { AddConditionReports1792300004000 } from './migrations/1792300004000-add-condition-reports';
import { AddFileCorrection1792300001000 } from './migrations/1792300001000-add-file-correction';
import { AddSourceModelReceipt1792300002000 } from './migrations/1792300002000-add-source-model-receipt';
import { AddBiGovernance1792300003000 } from './migrations/1792300003000-add-bi-governance';
import { AddFileRefreshActorEpoch1792580001000 } from './migrations/1792580001000-add-file-refresh-actor-epoch';
import { AddFileRefresh1792300000000 } from './migrations/1792300000000-add-file-refresh';
import { AddEnterpriseClassifications1792580000000 } from './migrations/1792580000000-add-enterprise-classifications';
import { AddSourceConditionSemantics1792570000000 } from './migrations/1792570000000-add-source-condition-semantics';
import { AddDashboardLifecycle1792560000000 } from './migrations/1792560000000-add-dashboard-lifecycle';
import { AddSourceDeleteReceipts1792550000000 } from './migrations/1792550000000-add-source-delete-receipts';
import { AddMetricDeleteReceipts1792540000000 } from './migrations/1792540000000-add-metric-delete-receipts';
import { AddDashboardDeleteReceipts1792530000000 } from './migrations/1792530000000-add-dashboard-delete-receipts';
import { AddPersonalLibraryState1792520000000 } from './migrations/1792520000000-add-personal-library-state';
import { AddExportJobs1792510000000 } from './migrations/1792510000000-add-export-jobs';
import { AddNotificationAudience1792500000000 } from './migrations/1792500000000-add-notification-audience';
import { AddGroupDeliveries1792490000000 } from './migrations/1792490000000-add-group-deliveries';
import { AddEnterpriseGroups1792480000000 } from './migrations/1792480000000-add-enterprise-groups';
import { AddDeliveryCopy1792470000000 } from './migrations/1792470000000-add-delivery-copy';
import { AddDashboardDeliveries1792460000000 } from './migrations/1792460000000-add-dashboard-deliveries';
import { AddNotificationState1792450000000 } from './migrations/1792450000000-add-notification-state';
import { AddSourceConditions1792440000000 } from './migrations/1792440000000-add-source-conditions';
import { AddAccountIntegrity1792430000000 } from './migrations/1792430000000-add-account-integrity';
import { AddSourceAvailability1792420000000 } from './migrations/1792420000000-add-source-availability';
import { AddEnterpriseResourceGrants1792410000000 } from './migrations/1792410000000-add-enterprise-resource-grants';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { AddEnterpriseMembership1792400000000 } from './migrations/1792400000000-add-enterprise-membership';
import { AddSourceCatalog1792300000000 } from './migrations/1792300000000-add-source-catalog';
import { StudioModule } from './dashboard-studio/studio.module';
import { AddDashboardStudio1792030000000 } from './migrations/1792030000000-add-dashboard-studio';
import { AddAnalysisCreationReceipts1792030000000 } from './migrations/1792030000000-add-analysis-creation-receipts';
import { AddDashboardReusePermissions1792120000000 } from './migrations/1792120000000-add-dashboard-reuse-permissions';
import { AddDashboardPublications1792040000000 } from './migrations/1792040000000-add-dashboard-publications';
import { AddDashboardPivots1791951000000 } from './migrations/1791951000000-add-dashboard-pivots';
import { BiModule } from './bi/bi.module';
import { AddPersonalViews1791854000000 } from './migrations/1791854000000-add-personal-views';
import { AddExploreViews1791855000000 } from './migrations/1791855000000-add-explore-views';
import { AddBiDefinitions1791853000000 } from './migrations/1791853000000-add-bi-definitions';
import { SourceOwnershipModule } from './ownership/source-ownership.module';
import { AddSourceOwner1791850000000 } from './migrations/1791850000000-add-source-owner';
import { AnalysisModule } from './analysis/analysis.module';
import { SeparateLegacyEventAndJobTables1792620300000 } from './migrations/1792620300000-separate-legacy-event-and-job-tables';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController, HealthController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { DatabaseModule } from './database/database.module';
// import { DatasetModule } from './dataset/dataset.module';
// import { WidgetModule } from './widget/widget.module';
// import { DashboardModule } from './dashboard/dashboard.module';
// import { TemplateModule } from './template/template.module';
import { CommonModule } from './common/common.module';
// import { ComponentModule } from './component/component.module';
// import { ConnectionModule } from './connection/connection.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { LoginModule } from './login/login.module';
import { AccessModule } from './access/access.module';
import { UsageModule } from './usage/usage.module';
// import { ShareUrlModule } from './share-url/share-url.module';
import { LoggerModule } from './common/logger/logger.module';
// import { MonitoringModule } from './common/monitoring/monitoring.module';
import { CorrelationIdMiddleware } from './middleware/correlation-id';
import { TestCompressionController } from './test-compression.controller';
import { TestFieldSelectionController } from './test-field-selection.controller';
import { FieldSelectionModule } from './common/field-selection/field-selection.module';
import { BatchModule } from './batch/batch.module';
import { CacheModule } from './common/optimization/cache.module';
import { PaginationModule } from './common/pagination/pagination.module';
import { BackgroundJobModule } from './background-job/background-job.module';
import { MemoryMonitorModule } from './common/monitoring/memory-monitor.module';
import { MemoryMonitorMiddleware } from './common/monitoring/memory-monitor.middleware';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor';
import { TypeOrmSlowQueryLogger } from './common/monitoring/typeorm-slow-query-logger';
import { CustomLoggerService } from './common/logger/logger.service';
import { SlowQueryMonitorService } from './common/monitoring/slow-query-monitor.service';
import { QueryAnalyzerService } from './common/monitoring/query-analyzer.service';
import { AnalyticsModule } from './analytics/analytics.module';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { EventsModule } from './events/events.module';
import { DatabaseModule } from './database/database.module';
import { InitializationModule } from './common/init/initialization.module';
import { DatasetModule } from './dataset/dataset.module';
import { WidgetModule } from './widget/widget.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TemplateModule } from './template/template.module';
import { ComponentModule } from './component/component.module';
import { ConnectionModule } from './connection/connection.module';
import { ShareUrlModule } from './share-url/share-url.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { SeederService } from './database/seeds/seeder.service';
import { AiModule } from './ai/ai.module';
import { MetricModule } from './metric/metric.module';
import { ProgressModule } from './progress/progress.module';
import { CommerceModule } from './commerce/commerce.module';
import { apiEnvFiles } from './config-env';
import { metadataDatabaseConfig, metadataDatabaseType } from './common/metadata-database';
import { PostgresBaseline1793500000000 } from './migrations/postgres/1793500000000-postgres-baseline';

@Module({
  imports: [
    ArtifactsModule,
    DocumentsModule,
    McpRemoteModule,
    LoggerModule,
    MonitoringModule,
    FieldSelectionModule,
    BatchModule,
    CacheModule,
    PaginationModule,
    BackgroundJobModule,
    MemoryMonitorModule,
    AnalyticsModule,
    EventsModule,
    InitializationModule,
    EnterpriseModule,
    StudioModule,
    ReportsModule,
    AnalysisModule,
    BiModule,
    SourceOwnershipModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: apiEnvFiles(),
    }),

    ThrottlerModule.forRoot({
      ttl: parseInt(process.env.THROTTLE_TTL) || 60,
      limit: parseInt(process.env.THROTTLE_LIMIT) || 120,
    }),

    TypeOrmModule.forRoot({
      ...metadataDatabaseConfig(),
      autoLoadEntities: true,
      migrations:
        metadataDatabaseType() === 'postgres'
          ? [PostgresBaseline1793500000000, AddDocumentSummary1793520000000, AddDocumentProvider1793530000000]
          : [
              AddFileArtifacts1793440000000,
              AddPrivateReports1793260000000,
              AddReportDeliveries1793270000000,
              AddDocumentConnections1793232000000,
              AddMcpOAuth1793233000000,
              SeparateLegacyEventAndJobTables1792620300000,
              AddHandoverProposal1792600000000,
              AddHandoverTransfer1792610000000,
              AddSourceHandover1792620000000,
              AddBundleHandover1792620100000,
              AddStaffDeparture1792620200000,
              AddFileRefresh1792300000000,
              AddFileRefreshActorEpoch1792580001000,
              AddFileCorrection1792300001000,
              AddSourceModelReceipt1792300002000,
              AddBiGovernance1792300003000,
              AddConditionReports1792300004000,
              AddEnterpriseClassifications1792580000000,
              AddSourceConditionSemantics1792570000000,
              AddDashboardLifecycle1792560000000,
              AddDashboardDeleteReceipts1792530000000,
              AddMetricDeleteReceipts1792540000000,
              AddSourceDeleteReceipts1792550000000,
              AddPersonalLibraryState1792520000000,
              AddExportJobs1792510000000,
              AddNotificationAudience1792500000000,
              AddGroupDeliveries1792490000000,
              AddEnterpriseGroups1792480000000,
              AddDeliveryCopy1792470000000,
              AddDashboardDeliveries1792460000000,
              AddNotificationState1792450000000,
              AddSourceConditions1792440000000,
              AddAccountIntegrity1792430000000,
              AddStaffTransfer1792590000000,
              AddSourceAvailability1792420000000,
              AddEnterpriseResourceGrants1792410000000,
              AddEnterpriseMembership1792400000000,
              AddSourceCatalog1792300000000,
              AddDashboardStudio1792030000000,
              AddDashboardReusePermissions1792120000000,
              AddDashboardPublications1792040000000,
              AddAnalysisCreationReceipts1792030000000,
              AddDashboardPivots1791951000000,
              AddSourceOwner1791850000000,
              AddBiDefinitions1791853000000,
              AddPersonalViews1791854000000,
              AddExploreViews1791855000000,
            ],
      migrationsRun: process.env.NODE_ENV === 'local',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV != 'prod',
      logging: process.env.NODE_ENV != 'prod',
      retryAttempts: 1,
    }),
    DatabaseModule,
    DatasetModule,
    WidgetModule,
    DashboardModule,
    TemplateModule,
    CommonModule,
    ComponentModule,
    ConnectionModule,
    UserModule,
    AuthModule,
    LoginModule,
    AccessModule,
    UsageModule,
    ShareUrlModule,
    AiModule,
    MetricModule,
    ProgressModule,
    CommerceModule,
  ],
  controllers: [
    AppController,
    HealthController,
    ...(process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'production'
      ? []
      : [TestCompressionController, TestFieldSelectionController]),
  ],
  providers: [
    { provide: 'APP_INTERCEPTOR', useClass: ResponseTimeInterceptor },
    { provide: 'APP_INTERCEPTOR', useClass: MetricsInterceptor },
    AppService,
    SeederService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Correlation ID 미들웨어를 모든 라우트에 적용
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');

    // Memory Monitor 미들웨어를 모든 라우트에 적용
    consumer.apply(MemoryMonitorMiddleware).forRoutes('*');
  }
}
