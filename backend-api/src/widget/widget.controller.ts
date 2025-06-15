import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { WidgetService } from './widget.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  FieldSelection,
  PredefinedFields,
} from '../common/field-selection/field-selection.decorator';
import { Pagination, PaginationInterceptor } from '../common/pagination';

@UseGuards(JwtAuthGuard)
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
  @UseInterceptors(PaginationInterceptor)
  @FieldSelection({
    allowedFields: [
      'id',
      'title',
      'description',
      'componentId',
      'datasetType',
      'datasetId',
      'option',
      'createdAt',
      'updatedAt',
    ],
    excludeFields: ['delYn'],
  })
  @Get()
  findAll(
    @Pagination({ preferCursor: true, defaultLimit: 20 }) pagination: any,
    @Query('fields') fields?: string,
  ) {
    return this.widgetService.findAll(pagination);
  }

  /**
   * 위젯 단건 조회
   * @param id
   */
  @PredefinedFields('widgetWithConfig')
  @Get(':id')
  findOne(@Param('id') id: string, @Query('fields') fields?: string) {
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
