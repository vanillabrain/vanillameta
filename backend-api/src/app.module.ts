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
import { AdminModule } from './admin/admin.module';

const isTest = process.env.NODE_ENV === 'test';
const isLocal = process.env.NODE_ENV === 'local';
const useSqlite = isLocal || isTest;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: isTest ? '.env.test' : process.env.NODE_ENV == 'prod' ? '.env' : '.env.dev',
    }),

    ThrottlerModule.forRoot({
      ttl: parseInt(process.env.THROTTLE_TTL) || 60,
      limit: parseInt(process.env.THROTTLE_LIMIT) || 120,
    }),

    TypeOrmModule.forRoot({
      type: useSqlite ? 'sqlite' : 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: isTest
        ? process.env.DB_NAME || 'test.sqlite.db'
        : isLocal
        ? 'sqlite.db'
        : process.env.DB_NAME,
      autoLoadEntities: true,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV != 'prod',
      logging: process.env.NODE_ENV != 'prod' && !isTest,
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
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
