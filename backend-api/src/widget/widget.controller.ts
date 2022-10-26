import {Controller, Get, Post, Body, Patch, Param, Delete, Put} from '@nestjs/common';
import { WidgetService } from './widget.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';

@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  /**
   * 위젯 생성
   * @param createWidgetDto
   */
  @Post()
  create(@Body() createWidgetDto: CreateWidgetDto) {
    return this.widgetService.create(createWidgetDto);
  }

  /**
   * 위젯 목록 조회
   */
  @Get()
  findAll() {
    return this.widgetService.findAll();
  }

  /**
   * 위젯 단건 조회
   * @param id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.widgetService.findOne(+id);
  }

  /**
   * 위젯 수정
   * @param id
   * @param updateWidgetDto
   */
  @Put(':id')
  update(@Param('id') id: string, @Body() updateWidgetDto: UpdateWidgetDto) {
    return this.widgetService.update(+id, updateWidgetDto);
  }

  /**
   * 위젯 삭제
   * @param id
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.widgetService.remove(+id);
  }
}
