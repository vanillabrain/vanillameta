import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Query } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FieldSelection, PredefinedFields } from '../common/field-selection/field-selection.decorator';

@UseGuards(JwtAuthGuard)
@Controller('dataset')
export class DatasetController {
  constructor(private readonly datasetService: DatasetService) {}

  /**
   * 데이터셋 생성
   * @param createDatasetDto
   */
  @Post()
  create(@Body() createDatasetDto: CreateDatasetDto) {
    return this.datasetService.create(createDatasetDto);
  }

  /**
   * 데이터셋 목록 조회
   */
  @PredefinedFields('datasetMeta')
  @Get()
  findAll(@Query('fields') fields?: string) {
    return this.datasetService.findAll();
  }

  /**
   * 데이터셋 단건 조회
   * @param id
   */
  @FieldSelection({
    allowedFields: ['id', 'title', 'databaseId', 'query', 'createdAt', 'updatedAt'],
    excludeFields: []
  })
  @Get(':id')
  findOne(@Param('id') id: string, @Query('fields') fields?: string) {
    return this.datasetService.findOne(+id);
  }

  /**
   * 데이터셋 수정
   * @param id
   * @param updateDatasetDto
   */
  @Put(':id')
  update(@Param('id') id: number, @Body() updateDatasetDto: UpdateDatasetDto) {
    return this.datasetService.update(+id, updateDatasetDto);
  }

  /**
   * 데이터셋 제거
   * @param id
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.datasetService.remove(+id);
  }
}
