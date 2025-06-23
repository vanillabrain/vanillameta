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
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import {
  ApiBearerAuth,
  ApiQuery,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { FieldSelection } from '../common/field-selection/field-selection.decorator';
import { UserCache, CacheConfig } from '../common/decorators/cache-config.decorator';

@ApiTags('대시보드')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('AccessToken')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post()
  @ApiOperation({
    summary: '대시보드 생성',
    description: '새로운 대시보드를 생성합니다.',
  })
  @ApiCreatedResponse({
    description: '대시보드가 성공적으로 생성되었습니다.',
    type: CreateDashboardDto,
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 데이터' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  create(@Body() createDashboardDto: CreateDashboardDto, @Req() req) {
    const { accessKeyData } = req.user;
    console.log('asdf', accessKeyData);
    return this.dashboardService.create(createDashboardDto, accessKeyData.id);
  }

  @UserCache(300) // 대시보드 목록 - 5분 캐시
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
    description: '현재 사용자의 모든 대시보드를 조회합니다.',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description:
      '반환할 필드 선택 (쉼표로 구분). 중첩 필드는 점(.)으로 구분. 예: id,title,widgets.id,widgets.name',
    example: 'id,title,description,widgets.id,widgets.name',
  })
  @ApiOkResponse({
    description: '대시보드 목록이 성공적으로 반환되었습니다.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          description: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          widgets: {
            type: 'array',
            items: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  findAll(@Req() req, @Query('fields') fields?: string) {
    const { accessKeyData } = req.user;
    return this.dashboardService.findAll(accessKeyData.id);
  }

  @UserCache(300) // 대시보드 상세 - 5분 캐시
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
    description: '특정 대시보드의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '대시보드 ID',
    type: 'number',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분). 중첩 필드는 점(.)으로 구분',
    example: 'id,title,widgets.id,widgets.config.title',
  })
  @ApiOkResponse({
    description: '대시보드 상세 정보가 성공적으로 반환되었습니다.',
  })
  @ApiNotFoundResponse({ description: '대시보드를 찾을 수 없습니다.' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  findOne(@Param('id') id: string, @Query('fields') fields?: string) {
    return this.dashboardService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({
    summary: '대시보드 수정',
    description: '기존 대시보드의 정보를 수정합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '대시보드 ID',
    type: 'number',
  })
  @ApiOkResponse({
    description: '대시보드가 성공적으로 수정되었습니다.',
  })
  @ApiNotFoundResponse({ description: '대시보드를 찾을 수 없습니다.' })
  @ApiBadRequestResponse({ description: '잘못된 요청 데이터' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  update(@Param('id') id: string, @Body() updateDashboardDto: UpdateDashboardDto) {
    return this.dashboardService.update(+id, updateDashboardDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '대시보드 삭제',
    description: '대시보드를 영구적으로 삭제합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '대시보드 ID',
    type: 'number',
  })
  @ApiOkResponse({
    description: '대시보드가 성공적으로 삭제되었습니다.',
  })
  @ApiNotFoundResponse({ description: '대시보드를 찾을 수 없습니다.' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  remove(@Param('id') id: string) {
    return this.dashboardService.remove(+id);
  }
}
