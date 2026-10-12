import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AiModule } from '../ai/ai.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommerceSource } from './entities/commerce-source.entity';
import { CommerceRun } from './entities/commerce-run.entity';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommerceSource, CommerceRun]), JwtModule, AiModule],
  controllers: [CommerceController],
  providers: [CommerceService, JwtAuthGuard],
})
export class CommerceModule {}
