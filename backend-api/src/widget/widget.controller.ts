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
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { WidgetService } from './widget.service';
import { CreateWidgetDto } from './dto/create-widget.dto';
import { UpdateWidgetDto } from './dto/update-widget.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import {
  FieldSelection,
  PredefinedFields,
} from '../common/field-selection/field-selection.decorator';
import { Pagination, PaginationInterceptor } from '../common/pagination';

@ApiTags('위젯')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Post()
  @ApiOperation({ 
    summary: '위젯 생성',
    description: '새로운 차트 위젯을 생성합니다. 위젯은 차트 타입, 데이터셋, 차트 옵션으로 구성됩니다.'
  })
  @ApiResponse({ 
    status: 201, 
    description: '위젯이 성공적으로 생성되었습니다.',
    type: CreateWidgetDto
  })
  @ApiResponse({ 
    status: 400, 
    description: '잘못된 요청 데이터 또는 유효하지 않은 차트 옵션' 
  })
  @ApiResponse({ 
    status: 404, 
    description: '데이터셋 또는 컴포넌트를 찾을 수 없습니다.' 
  })
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
  @ApiOperation({ 
    summary: '위젯 목록 조회',
    description: '생성된 모든 위젯 목록을 조회합니다. 필드 선택 기능을 통해 필요한 필드만 조회할 수 있습니다.'
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분). 허용된 필드: id, title, description, componentId, datasetType, datasetId, option, createdAt, updatedAt',
    example: 'id,title,componentId,datasetId'
  })
  @ApiResponse({ 
    status: 200, 
    description: '위젯 목록이 반환되었습니다.',
    type: [CreateWidgetDto]
  })
  findAll(
    @Pagination({ preferCursor: true, defaultLimit: 20 }) pagination: any,
    @Query('fields') fields?: string,
  ) {
    return this.widgetService.findAll(pagination);
  }

  @PredefinedFields('widgetWithConfig')
  @Get(':id')
  @ApiOperation({ 
    summary: '위젯 상세 조회',
    description: '특정 위젯의 상세 정보를 조회합니다. 차트 옵션과 데이터셋 정보를 포함합니다.'
  })
  @ApiParam({
    name: 'id',
    description: '위젯 ID',
    type: Number,
    example: 1
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분). 미리 정의된 widgetWithConfig 필드 셋을 사용합니다.',
    example: 'id,title,option'
  })
  @ApiResponse({ 
    status: 200, 
    description: '위젯 정보가 반환되었습니다.',
    type: CreateWidgetDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '위젯을 찾을 수 없습니다.' 
  })
  findOne(@Param('id') id: string, @Query('fields') fields?: string) {
    return this.widgetService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: '위젯 수정',
    description: '기존 위젯의 정보를 수정합니다. 제목, 설명, 차트 옵션, 데이터셋 등을 변경할 수 있습니다.'
  })
  @ApiParam({
    name: 'id',
    description: '위젯 ID',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: '위젯이 성공적으로 수정되었습니다.',
    type: UpdateWidgetDto
  })
  @ApiResponse({ 
    status: 400, 
    description: '잘못된 요청 데이터 또는 유효하지 않은 차트 옵션' 
  })
  @ApiResponse({ 
    status: 404, 
    description: '위젯을 찾을 수 없습니다.' 
  })
  update(@Param('id') id: string, @Body() updateWidgetDto: UpdateWidgetDto) {
    return this.widgetService.update(+id, updateWidgetDto);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: '위젯 삭제',
    description: '위젯을 삭제합니다. 대시보드에서 사용 중인 위젯은 삭제할 수 없습니다.'
  })
  @ApiParam({
    name: 'id',
    description: '위젯 ID',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: '위젯이 성공적으로 삭제되었습니다.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: '위젯을 찾을 수 없습니다.' 
  })
  @ApiResponse({ 
    status: 409, 
    description: '사용 중인 위젯은 삭제할 수 없습니다.' 
  })
  remove(@Param('id') id: string) {
    return this.widgetService.remove(+id);
  }
}
