import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateTemplateItemDto } from './dto/create-template-item.dto';
import { UpdateTemplateItemDto } from './dto/update-template-item.dto';
import { TemplateInfoDto } from './dto/template-info.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('템플릿')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('template')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @ApiOperation({
    summary: '템플릿 생성',
    description:
      '새로운 대시보드 템플릿을 생성합니다. 템플릿은 위젯 배치와 레이아웃 정보를 포함합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '템플릿이 성공적으로 생성되었습니다.',
    type: CreateTemplateDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 데이터입니다.',
  })
  create(@Body() createTemplateDto: CreateTemplateDto) {
    return this.templateService.create(createTemplateDto);
  }

  @Get()
  @ApiOperation({
    summary: '템플릿 목록 조회',
    description: '사용 가능한 모든 대시보드 템플릿 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '템플릿 목록이 반환되었습니다.',
    type: [CreateTemplateDto],
  })
  findAll() {
    return this.templateService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: '템플릿 상세 조회',
    description: '특정 템플릿의 상세 정보를 조회합니다. 레이아웃과 위젯 배치 정보를 포함합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '템플릿 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '템플릿 정보가 반환되었습니다.',
    type: CreateTemplateDto,
  })
  @ApiResponse({
    status: 404,
    description: '템플릿을 찾을 수 없습니다.',
  })
  async findOne(@Res() res, @Param('id') id: number) {
    return await this.templateService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: '템플릿 수정',
    description:
      '기존 템플릿의 정보를 수정합니다. 템플릿 이름, 설명, 레이아웃 등을 변경할 수 있습니다.',
  })
  @ApiParam({
    name: 'id',
    description: '템플릿 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '템플릿이 성공적으로 수정되었습니다.',
    type: UpdateTemplateDto,
  })
  @ApiResponse({
    status: 404,
    description: '템플릿을 찾을 수 없습니다.',
  })
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto) {
    return this.templateService.update(+id, updateTemplateDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '템플릿 삭제',
    description: '템플릿을 삭제합니다. 실제 삭제가 아닌 사용여부를 N으로 변경합니다 (논리적 삭제).',
  })
  @ApiParam({
    name: 'id',
    description: '템플릿 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '템플릿이 성공적으로 삭제되었습니다.',
  })
  @ApiResponse({
    status: 404,
    description: '템플릿을 찾을 수 없습니다.',
  })
  @ApiResponse({
    status: 409,
    description: '사용 중인 템플릿은 삭제할 수 없습니다.',
  })
  remove(@Param('id') id: string) {
    return this.templateService.remove(+id);
  }

  @Post('/recommend')
  @ApiOperation({
    summary: '템플릿 추천 목록 조회',
    description:
      '제공된 위젯 목록을 기반으로 적합한 템플릿을 추천합니다. AI 기반 매칭 알고리즘을 사용합니다.',
  })
  @ApiBody({
    description: '위젯 목록',
    schema: {
      type: 'object',
      properties: {
        widgets: {
          type: 'array',
          description: '분석할 위젯 ID 목록',
          items: { type: 'number' },
          example: [1, 2, 3, 4],
        },
      },
      required: ['widgets'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '추천 템플릿 목록이 반환되었습니다.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', description: '템플릿 ID' },
          name: { type: 'string', description: '템플릿 이름' },
          description: { type: 'string', description: '템플릿 설명' },
          matchScore: { type: 'number', description: '매칭 점수 (0-100)', example: 85.5 },
          matchingWidgets: {
            type: 'array',
            description: '매칭된 위젯 ID 목록',
            items: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 위젯 목록입니다.',
  })
  findRecommendAll(@Body() body) {
    return this.templateService.findRecommendTemplates(body.widgets);
  }

  @Post('/dashboard')
  @ApiOperation({
    summary: '템플릿 기반 대시보드 레이아웃 생성',
    description:
      '선택된 템플릿과 위젯 목록을 기반으로 최적화된 대시보드 레이아웃을 생성합니다. 위젯 위치와 크기가 자동으로 계산됩니다.',
  })
  @ApiBody({
    description: '템플릿 ID와 위젯 목록',
    schema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'number',
          description: '사용할 템플릿 ID',
          example: 1,
        },
        widgets: {
          type: 'array',
          description: '배치할 위젯 목록',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', description: '위젯 ID' },
              type: { type: 'string', description: '위젯 타입' },
              priority: { type: 'number', description: '우선순위 (옵션)' },
            },
          },
          example: [
            { id: 1, type: 'line' },
            { id: 2, type: 'bar' },
            { id: 3, type: 'pie' },
          ],
        },
      },
      required: ['templateId', 'widgets'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '대시보드 레이아웃이 생성되었습니다.',
    schema: {
      type: 'object',
      properties: {
        layout: {
          type: 'array',
          description: 'React Grid Layout 형식의 레이아웃 배열',
          items: {
            type: 'object',
            properties: {
              i: { type: 'string', description: '위젯 ID' },
              x: { type: 'number', description: 'X 좌표' },
              y: { type: 'number', description: 'Y 좌표' },
              w: { type: 'number', description: '너비' },
              h: { type: 'number', description: '높이' },
              minW: { type: 'number', description: '최소 너비' },
              minH: { type: 'number', description: '최소 높이' },
            },
          },
        },
        templateInfo: {
          type: 'object',
          description: '사용된 템플릿 정보',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            cols: { type: 'number', description: '그리드 열 수' },
            rowHeight: { type: 'number', description: '행 높이' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 템플릿 ID 또는 위젯 목록입니다.',
  })
  @ApiResponse({
    status: 404,
    description: '템플릿을 찾을 수 없습니다.',
  })
  getTemplateDashboardLayout(@Body() data) {
    return this.templateService.getTemplateDashboardLayout(data.widgets, data.templateId);
  }
}
