import { Module } from '@nestjs/common';
import { WidgetViewService } from './widget-view.service';
import { WidgetViewController } from './widget-view.controller';

@Module({
  controllers: [WidgetViewController],
  providers: [WidgetViewService]
})
export class WidgetViewModule {}
