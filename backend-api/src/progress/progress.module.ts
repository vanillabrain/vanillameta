import { Global, Module } from '@nestjs/common';
import { ProgressGateway } from './progress.gateway';

@Global()
@Module({
  providers: [ProgressGateway],
  exports: [ProgressGateway],
})
export class ProgressModule {}
