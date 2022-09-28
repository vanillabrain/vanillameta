import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { WidgetViewService } from './widget-view.service';
import { CreateWidgetViewDto } from './dto/create-widget-view.dto';
import { UpdateWidgetViewDto } from './dto/update-widget-view.dto';

@Controller('widget-view')
export class WidgetViewController {
  constructor(private readonly widgetViewService: WidgetViewService) {}

  @Post()
  create(@Body() createWidgetViewDto: CreateWidgetViewDto) {
    return this.widgetViewService.create(createWidgetViewDto);
  }

  @Get()
  findAll() {
    return this.widgetViewService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.widgetViewService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWidgetViewDto: UpdateWidgetViewDto) {
    return this.widgetViewService.update(+id, updateWidgetViewDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.widgetViewService.remove(+id);
  }
}
