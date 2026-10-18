import { SourceAccessService } from '../ownership/source-access.service';
import { SourceOwnershipGuard } from '../ownership/source-ownership.guard';
import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Req } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, SourceOwnershipGuard)
@Controller('dataset')
export class DatasetController {
  constructor(
    private readonly datasetService: DatasetService,
    private readonly access: SourceAccessService,
  ) {}

  /**
   * 데이터셋 생성
   * @param createDatasetDto
   */
  @Post()
  create(@Body() createDatasetDto: CreateDatasetDto, @Req() req) {
    return this.datasetService.create(
      createDatasetDto,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
  }

  /**
   * 데이터셋 목록 조회
   */
  @Get()
  async findAll(@Req() req) {
    return this.access.filterResults(
      'dataset',
      this.access.actor(req.user.accessKeyData.id),
      await this.datasetService.findAll(),
    );
  }

  /**
   * 데이터셋 단건 조회
   * @param id
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.datasetService.findOne(+id);
  }

  /**
   * 데이터셋 수정
   * @param id
   * @param updateDatasetDto
   */
  @Put(':id')
  update(@Param('id') id: number, @Body() updateDatasetDto: UpdateDatasetDto, @Req() req) {
    return this.datasetService.update(
      +id,
      updateDatasetDto,
      this.access.actor(req.user.accessKeyData.id),
      req.user.accessKeyData.authVersion ?? 0,
    );
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
