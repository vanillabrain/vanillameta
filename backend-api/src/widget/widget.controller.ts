import { Controller, Get, Post, Body, Param, Delete, Put, Req, UseGuards } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  /**
   * 위젯 생성
   * @param createWidgetDto
   */
  @Post()
  create(@Req() req, @Body() createWidgetDto: CreateWidgetDto) {
    return this.widgetService.create(createWidgetDto, req.user.accessKeyData.id);
  }

  /**
   * 위젯 목록 조회
   */
  @Get()
  findAll(@Req() req) {
    return this.widgetService.findAll(req.user.accessKeyData.id);
  }

  /**
   * 위젯 단건 조회
   * @param id
   */
  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.widgetService.findOne(+id, req.user.accessKeyData.id);
  }

  /**
   * 위젯 수정
   * @param id
   * @param updateWidgetDto
   */
  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() updateWidgetDto: UpdateWidgetDto) {
    return this.widgetService.update(+id, updateWidgetDto, req.user.accessKeyData.id);
  }

  /**
   * 위젯 삭제
   * @param id
   */
  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.widgetService.remove(+id, req.user.accessKeyData.id);
  }
}
