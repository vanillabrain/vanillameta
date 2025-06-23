import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CacheConfig } from '../common/decorators/cache-config.decorator';
import { ComponentService } from './component.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';

@ApiTags('컴포넌트')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('component')
export class ComponentController {
  constructor(private readonly componentService: ComponentService) {}

  @Post('/seed')
  @ApiOperation({
    summary: '차트 컴포넌트 일괄 등록',
    description: '여러 차트 컴포넌트를 한 번에 등록합니다. 초기 시드 데이터 생성 시 사용됩니다.',
  })
  @ApiResponse({
    status: 201,
    description: '컴포넌트들이 성공적으로 생성되었습니다.',
    type: [CreateComponentDto],
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 데이터입니다.',
  })
  async multipleCreate(@Body() createComponents: CreateComponentDto[]) {
    return this.componentService.multipleCreate(createComponents);
  }

  @Post()
  @ApiOperation({
    summary: '차트 컴포넌트 생성',
    description: '새로운 차트 컴포넌트를 등록합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '컴포넌트가 성공적으로 생성되었습니다.',
    type: CreateComponentDto,
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 데이터입니다.',
  })
  @ApiResponse({
    status: 409,
    description: '이미 존재하는 컴포넌트입니다.',
  })
  async create(@Body() createComponent: CreateComponentDto) {
    return this.componentService.create(createComponent);
  }

  @CacheConfig({ ttl: 3600 }) // 컴포넌트 목록 - 1시간 캐시 (정적 데이터)
  @Get()
  @ApiOperation({
    summary: '전체 차트 컴포넌트 목록 조회',
    description: '시스템에서 사용 가능한 모든 차트 컴포넌트 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '컴포넌트 목록이 반환되었습니다.',
    type: [CreateComponentDto],
  })
  findAll() {
    return this.componentService.findAll();
  }

  @CacheConfig({ ttl: 3600 }) // 컴포넌트 상세 - 1시간 캐시 (정적 데이터)
  @Get(':id')
  @ApiOperation({
    summary: '특정 차트 컴포넌트 조회',
    description: '지정된 ID의 차트 컴포넌트 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '컴포넌트 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '컴포넌트 정보가 반환되었습니다.',
    type: CreateComponentDto,
  })
  @ApiResponse({
    status: 404,
    description: '컴포넌트를 찾을 수 없습니다.',
  })
  findOne(@Param('id') id: number) {
    return this.componentService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '차트 컴포넌트 수정',
    description: '기존 차트 컴포넌트의 정보를 수정합니다.',
  })
  @ApiParam({
    name: 'id',
    description: '컴포넌트 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '컴포넌트가 성공적으로 수정되었습니다.',
    type: UpdateComponentDto,
  })
  @ApiResponse({
    status: 404,
    description: '컴포넌트를 찾을 수 없습니다.',
  })
  update(@Param('id') id: number, @Body() body: UpdateComponentDto) {
    return this.componentService.update(+id, body);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '차트 컴포넌트 삭제',
    description:
      '지정된 차트 컴포넌트를 삭제합니다. 위젯에서 사용 중인 컴포넌트는 삭제할 수 없습니다.',
  })
  @ApiParam({
    name: 'id',
    description: '컴포넌트 ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '컴포넌트가 성공적으로 삭제되었습니다.',
  })
  @ApiResponse({
    status: 404,
    description: '컴포넌트를 찾을 수 없습니다.',
  })
  @ApiResponse({
    status: 409,
    description: '사용 중인 컴포넌트는 삭제할 수 없습니다.',
  })
  remove(@Param('id') id: number) {
    return this.componentService.remove(+id);
  }
}
