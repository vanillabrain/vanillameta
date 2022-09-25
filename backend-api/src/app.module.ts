import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SampleModule } from './sample/sample.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from './database/database.module';
import { DatasetModule } from './dataset/dataset.module';
import { WidgetModule } from './widget/widget.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TemplateModule } from './template/template.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV == 'dev' ? '.env.dev' : '.env.prod',
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      // type: process.env.DB_TYPE,
      // host: process.env.DB_HOST,
      // port: parseInt(process.env.DB_PORT) || 3306,
      // username: process.env.DB_USERNAME,
      // password: process.env.DB_PASSWORD,
      // database: process.env.DB_NAME,
      database: 'vanillameta',
      autoLoadEntities: true,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: process.env.NODE_ENV == 'dev',
      retryAttempts: 1,
    }),
    SampleModule,
    DatabaseModule,
    DatasetModule,
    WidgetModule,
    DashboardModule,
    TemplateModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
