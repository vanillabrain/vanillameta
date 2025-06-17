import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
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
import { DatasetModule } from './dataset/dataset.module';
import { WidgetModule } from './widget/widget.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TemplateModule } from './template/template.module';
import { ComponentModule } from './component/component.module';
import { ConnectionModule } from './connection/connection.module';
import { ShareUrlModule } from './share-url/share-url.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV == 'local'
          ? '.env.local'
          : process.env.NODE_ENV == 'prod'
          ? '.env'
          : '.env.dev',
    }),

    TypeOrmModule.forRootAsync({
      imports: [LoggerModule, MonitoringModule],
      inject: [CustomLoggerService, SlowQueryMonitorService, QueryAnalyzerService],
      useFactory: (
        customLogger: CustomLoggerService,
        slowQueryMonitorService: SlowQueryMonitorService,
        queryAnalyzerService: QueryAnalyzerService,
      ) => ({
      type: process.env.NODE_ENV == 'local' ? 'sqlite' : 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.NODE_ENV == 'local' ? 'sqlite.db' : process.env.DB_NAME,
      autoLoadEntities: true,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV != 'prod',
      logging: process.env.NODE_ENV != 'prod',
      logger: new TypeOrmSlowQueryLogger(
        customLogger,
        slowQueryMonitorService,
        queryAnalyzerService,
      ),
      retryAttempts: 1,
      // 연결 재사용을 위한 설정
      keepConnectionAlive: true, // 애플리케이션 재시작 시 연결 유지
      retryDelay: 3000, // 재시도 간격 (3초)
      }),
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
    ShareUrlModule,
    MonitoringModule,
    FieldSelectionModule,
    BatchModule,
    CacheModule,
    PaginationModule,
    BackgroundJobModule,
    MemoryMonitorModule,
    AnalyticsModule,
    EventsModule,
  ],
  controllers: [AppController, TestCompressionController, TestFieldSelectionController],
  providers: [
    AppService,
    {
      provide: 'APP_INTERCEPTOR',
      useClass: ResponseTimeInterceptor,
    },
    {
      provide: 'APP_INTERCEPTOR',
      useClass: MetricsInterceptor,
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
