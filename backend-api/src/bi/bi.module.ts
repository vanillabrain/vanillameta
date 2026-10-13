import { JwtService } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConnectionModule } from '../connection/connection.module';
import { BiController } from './bi.controller';
import { BiService } from './bi.service';
@Module({
  imports: [AiModule, ConnectionModule],
  controllers: [BiController],
  providers: [BiService, JwtService],
})
export class BiModule {}
