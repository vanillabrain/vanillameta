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
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from './database/database.module';
import { DatasetModule } from './dataset/dataset.module';
import { WidgetModule } from './widget/widget.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TemplateModule } from './template/template.module';
import { CommonModule } from './common/common.module';
import { ComponentModule } from './component/component.module';
import { ConnectionModule } from './connection/connection.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { LoginModule } from './login/login.module';
import { ShareUrlModule } from './share-url/share-url.module';
import { SeederService } from './database/seeds/seeder.service';
import { AiModule } from './ai/ai.module';
import { MetricModule } from './metric/metric.module';
import { ProgressModule } from './progress/progress.module';
import { CommerceModule } from './commerce/commerce.module';
import { apiEnvFiles } from './config-env';

@Module({
  imports: [
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
      type: process.env.NODE_ENV == 'local' ? 'sqlite' : 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database:
        process.env.NODE_ENV == 'local'
          ? process.env.SQLITE_PATH || 'sqlite.db'
          : process.env.DB_NAME,
      autoLoadEntities: true,
      migrations: [
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
    ShareUrlModule,
    AiModule,
    MetricModule,
    ProgressModule,
    CommerceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SeederService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
