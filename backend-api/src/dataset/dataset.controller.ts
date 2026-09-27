import { Controller, Get, Post, Body, Param, Delete, Put, Req, UseGuards } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('dataset')
export class DatasetController {
  constructor(private readonly datasetService: DatasetService) {}

  /**
   * 데이터셋 생성
   * @param createDatasetDto
   */
  @Post()
  create(@Req() req, @Body() createDatasetDto: CreateDatasetDto) {
    return this.datasetService.create(createDatasetDto, req.user.accessKeyData.id);
  }

  /**
   * 데이터셋 목록 조회
   */
  @Get()
  findAll(@Req() req) {
    return this.datasetService.findAll(req.user.accessKeyData.id);
  }

  /**
   * 데이터셋 단건 조회
   * @param id
   */
  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.datasetService.findOne(+id, req.user.accessKeyData.id);
  }

  /**
   * 데이터셋 수정
   * @param id
   * @param updateDatasetDto
   */
  @Put(':id')
  update(@Req() req, @Param('id') id: string, @Body() updateDatasetDto: UpdateDatasetDto) {
    return this.datasetService.update(+id, updateDatasetDto, req.user.accessKeyData.id);
  }

  /**
   * 데이터셋 제거
   * @param id
   */
  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.datasetService.remove(+id, req.user.accessKeyData.id);
  }
}
