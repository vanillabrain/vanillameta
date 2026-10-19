import { SourceAccessService } from '../ownership/source-access.service';
import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';
import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, SourceOwnershipGuard)
@Controller('widget')
export class WidgetController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly access: SourceAccessService,
  ) {}

  /**
   * 위젯 생성
   * @param createWidgetDto
   */
  @Post()
  create(@Body() createWidgetDto: CreateWidgetDto, @Req() req) {
    return this.widgetService.create(
      createWidgetDto,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  /**
   * 위젯 목록 조회
   */
  @Get()
  async findAll(@Req() req) {
    return this.access.filterResults(
      'widget',
      this.access.actor(req.user.accessKeyData.id),
      await this.widgetService.findAll(),
    );
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
  update(@Param('id') id: string, @Body() updateWidgetDto: UpdateWidgetDto, @Req() req) {
    return this.widgetService.update(
      +id,
      updateWidgetDto,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  /**
   * 위젯 삭제
   * @param id
   */
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.widgetService.remove(
      +id,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }
}
