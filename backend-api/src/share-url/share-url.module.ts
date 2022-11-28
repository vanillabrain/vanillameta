import { Module } from '@nestjs/common';
import { ShareUrlService } from './share-url.service';
import { ShareUrlController } from './share-url.controller';

@Module({
  controllers: [ShareUrlController],
  providers: [ShareUrlService]
})
export class ShareUrlModule {}
