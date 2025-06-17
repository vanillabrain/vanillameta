import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Query } from '@nestjs/common';
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
  ApiBadRequestResponse
} from '@nestjs/swagger';

@ApiTags('위젯')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('AccessToken')
@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  /**
   * 위젯 생성
   * @param createWidgetDto
   */
  @Post()
  @ApiOperation({ 
    summary: '위젯 생성', 
    description: '새로운 차트 위젯을 생성합니다. 데이터셋과 차트 컴포넌트를 지정해야 합니다.' 
  })
  @ApiCreatedResponse({ 
    description: '위젯이 성공적으로 생성되었습니다.',
    type: CreateWidgetDto
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 데이터' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  create(@Body() createWidgetDto: CreateWidgetDto) {
    return this.widgetService.create(createWidgetDto);
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
  @ApiOperation({ 
    summary: '위젯 목록 조회', 
    description: '모든 위젯의 목록을 조회합니다.' 
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분)',
    example: 'id,title,description,componentId',
  })
  @ApiOkResponse({ 
    description: '위젯 목록이 성공적으로 반환되었습니다.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          description: { type: 'string' },
          componentId: { type: 'number' },
          datasetType: { type: 'string' },
          datasetId: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  findAll(@Query('fields') fields?: string) {
    return this.widgetService.findAll();
  }

  /**
   * 위젯 단건 조회
   * @param id
   */
  @PredefinedFields('widgetWithConfig')
  @Get(':id')
  @ApiOperation({ 
    summary: '위젯 상세 조회', 
    description: '특정 위젯의 상세 정보를 조회합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '위젯 ID',
    type: 'number'
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분)',
  })
  @ApiOkResponse({ 
    description: '위젯 상세 정보가 성공적으로 반환되었습니다.' 
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
  @ApiOperation({ 
    summary: '위젯 수정', 
    description: '기존 위젯의 정보를 수정합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '위젯 ID',
    type: 'number'
  })
  @ApiOkResponse({ 
    description: '위젯이 성공적으로 수정되었습니다.' 
  })
  @ApiNotFoundResponse({ description: '위젯을 찾을 수 없습니다.' })
  @ApiBadRequestResponse({ description: '잘못된 요청 데이터' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  update(@Param('id') id: string, @Body() updateWidgetDto: UpdateWidgetDto) {
    return this.widgetService.update(+id, updateWidgetDto);
  }

  /**
   * 위젯 삭제
   * @param id
   */
  @Delete(':id')
  @ApiOperation({ 
    summary: '위젯 삭제', 
    description: '위젯을 영구적으로 삭제합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '위젯 ID',
    type: 'number'
  })
  @ApiOkResponse({ 
    description: '위젯이 성공적으로 삭제되었습니다.' 
  })
  @ApiNotFoundResponse({ description: '위젯을 찾을 수 없습니다.' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  remove(@Param('id') id: string) {
    return this.widgetService.remove(+id);
  }
}
