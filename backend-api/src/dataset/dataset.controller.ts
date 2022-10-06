import {Controller, Get, Post, Body, Patch, Param, Delete, Put} from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';

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

  @Get()
  findAll() {
    return this.datasetService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.datasetService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: number, @Body() updateDatasetDto: UpdateDatasetDto) {
    return this.datasetService.update(+id, updateDatasetDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.datasetService.remove(+id);
  }
}
