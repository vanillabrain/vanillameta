import { Global, Module } from '@nestjs/common';
import { SourceAccessService } from './source-access.service';
import { SourceOwnershipGuard } from './source-ownership.guard';
@Global()
@Module({
  providers: [SourceAccessService, SourceOwnershipGuard],
  exports: [SourceAccessService, SourceOwnershipGuard],
})
export class SourceOwnershipModule {}
