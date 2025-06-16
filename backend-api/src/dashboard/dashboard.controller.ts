import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { FieldSelection } from '../common/field-selection/field-selection.decorator';
import { Pagination, PaginationInterceptor } from '../common/pagination';

@ApiTags('대시보드')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post()
  @ApiOperation({ 
    summary: '대시보드 생성',
    description: '새로운 대시보드를 생성합니다. 대시보드는 여러 위젯을 포함할 수 있습니다.'
  })
  @ApiResponse({ 
    status: 201, 
    description: '대시보드가 성공적으로 생성되었습니다.',
    type: CreateDashboardDto
  })
  @ApiResponse({ 
    status: 400, 
    description: '잘못된 요청 데이터' 
  })
  create(@Body() createDashboardDto: CreateDashboardDto, @Req() req) {
    const { accessKeyData } = req.user;
    console.log('asdf', accessKeyData);
    return this.dashboardService.create(createDashboardDto, accessKeyData.id);
  }

  @UseInterceptors(PaginationInterceptor)
  @FieldSelection({
    allowedFields: [
      'id',
      'title',
      'description',
      'createdAt',
      'updatedAt',
      'widgets.id',
      'widgets.name',
      'widgets.type',
      'widgets.order',
      'widgets.config.title',
      'widgets.config.chartType',
      'widgets.config.layout',
    ],
    excludeFields: ['widgets.config.queries', 'widgets.data'],
  })
  @Get()
  @ApiOperation({ 
    summary: '대시보드 목록 조회',
    description: '사용자가 생성한 모든 대시보드 목록을 조회합니다.'
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description:
      '반환할 필드 선택 (쉼표로 구분). 중첩 필드는 점(.)으로 구분. 예: id,title,widgets.id,widgets.name',
    example: 'id,title,description,widgets.id,widgets.name',
  })
  @ApiResponse({ 
    status: 200, 
    description: '대시보드 목록이 반환되었습니다.',
    type: [CreateDashboardDto]
  })
  findAll(
    @Req() req,
    @Pagination({ preferCursor: true, defaultLimit: 20 }) pagination: any,
    @Query('fields') fields?: string,
  ) {
    const { accessKeyData } = req.user;
    return this.dashboardService.findAll(accessKeyData.id, pagination);
  }

  @FieldSelection({
    allowedFields: [
      'id',
      'title',
      'description',
      'createdAt',
      'updatedAt',
      'widgets.id',
      'widgets.name',
      'widgets.type',
      'widgets.order',
      'widgets.config.title',
      'widgets.config.chartType',
      'widgets.config.layout',
      'widgets.config.xAxis',
      'widgets.config.yAxis',
      'widgets.config.groupBy',
      'widgets.dataset.id',
      'widgets.dataset.name',
    ],
    excludeFields: ['widgets.config.queries', 'widgets.data', 'widgets.rawData'],
  })
  @Get(':id')
  @ApiOperation({ 
    summary: '대시보드 상세 조회',
    description: '특정 대시보드의 상세 정보를 조회합니다. 위젯 목록과 설정 정보를 포함합니다.'
  })
  @ApiParam({
    name: 'id',
    description: '대시보드 ID',
    type: Number,
    example: 1
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분). 중첩 필드는 점(.)으로 구분',
    example: 'id,title,widgets.id,widgets.config.title',
  })
  @ApiResponse({ 
    status: 200, 
    description: '대시보드 정보가 반환되었습니다.',
    type: CreateDashboardDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '대시보드를 찾을 수 없습니다.' 
  })
  findOne(@Param('id') id: string, @Query('fields') fields?: string) {
    return this.dashboardService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: '대시보드 수정',
    description: '기존 대시보드의 정보를 수정합니다. 제목, 설명, 레이아웃 등을 변경할 수 있습니다.'
  })
  @ApiParam({
    name: 'id',
    description: '대시보드 ID',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: '대시보드가 성공적으로 수정되었습니다.',
    type: UpdateDashboardDto
  })
  @ApiResponse({ 
    status: 404, 
    description: '대시보드를 찾을 수 없습니다.' 
  })
  @ApiResponse({ 
    status: 403, 
    description: '해당 대시보드를 수정할 권한이 없습니다.' 
  })
  update(@Param('id') id: string, @Body() updateDashboardDto: UpdateDashboardDto) {
    return this.dashboardService.update(+id, updateDashboardDto);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: '대시보드 삭제',
    description: '대시보드를 삭제합니다. 관련된 모든 위젯도 함께 삭제됩니다.'
  })
  @ApiParam({
    name: 'id',
    description: '대시보드 ID',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: '대시보드가 성공적으로 삭제되었습니다.' 
  })
  @ApiResponse({ 
    status: 404, 
    description: '대시보드를 찾을 수 없습니다.' 
  })
  @ApiResponse({ 
    status: 403, 
    description: '해당 대시보드를 삭제할 권한이 없습니다.' 
  })
  remove(@Param('id') id: string) {
    return this.dashboardService.remove(+id);
  }
}
