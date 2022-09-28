import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';

@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Post()
  create(@Body() createWidgetDto: CreateWidgetDto) {
    return this.widgetService.create(createWidgetDto);
  }

  @Get()
  findAll() {
    return this.widgetService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.widgetService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateWidgetDto: UpdateWidgetDto) {
    return this.widgetService.update(+id, updateWidgetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.widgetService.remove(+id);
  }
}
