import { Module } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { WidgetController } from './widget.controller';

@Module({
  controllers: [WidgetController],
  providers: [WidgetService]
})
export class WidgetModule {}
