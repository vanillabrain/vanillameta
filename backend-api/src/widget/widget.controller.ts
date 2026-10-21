import { Query } from '@nestjs/common';
import { SourceAccessService } from '../ownership/source-access.service';
import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';
import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { WidgetService } from './widget.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  FieldSelection,
  PredefinedFields,
} from '../common/field-selection/field-selection.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

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
  @PredefinedFields('widgetWithConfig')
  @Get(':id')
  @ApiOperation({
    summary: '위젯 상세 조회',
    description: '특정 위젯의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '위젯 ID',
    type: 'number',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분)',
  })
  @ApiOkResponse({
    description: '위젯 상세 정보가 성공적으로 반환되었습니다.',
  })
  @ApiNotFoundResponse({ description: '위젯을 찾을 수 없습니다.' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  findOne(@Param('id') id: string, @Query('fields') fields?: string) {
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
