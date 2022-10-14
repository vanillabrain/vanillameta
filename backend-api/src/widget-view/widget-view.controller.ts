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

  @Post('/widgetcreate')
  widgetcreate(@Body() data: number) {
    return this.widgetViewService.widgetcreate(data);
  }

  @Get()
  findAll() {
    return this.widgetViewService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.widgetViewService.findOne(+id);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateWidgetViewDto: UpdateWidgetViewDto) {
  //   return this.widgetViewService.update(+id, updateWidgetViewDto);
  // }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.widgetViewService.remove(+id);
  }
}
