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
  Res,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FieldSelection,
  PredefinedFields,
} from '../common/field-selection/field-selection.decorator';
import { Response } from 'express';
import { GetUser } from '../auth/decorators/get-user.decorator';

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
    excludeFields: [],
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

  /**
   * 데이터셋 스트리밍 쿼리 실행
   * @param id 데이터셋 ID
   * @param user 인증된 사용자 정보
   * @param res Express Response 객체
   */
  @Get(':id/stream')
  @Header('Content-Type', 'application/x-ndjson')
  @Header('Transfer-Encoding', 'chunked')
  @Header('Cache-Control', 'no-cache')
  async streamQuery(@Param('id') id: string, @GetUser() user: any, @Res() res: Response) {
    try {
      // 스트리밍 쿼리 실행
      const { stream, error } = await this.datasetService.executeStreamingQuery(
        +id,
        user?.userId || user?.id,
      );

      if (error) {
        return res.status(500).json({
          status: 'error',
          message: error,
        });
      }

      // 스트림을 응답에 파이프
      stream.pipe(res);

      // 스트림 에러 처리
      stream.on('error', err => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            status: 'error',
            message: 'Stream error occurred',
          });
        }
      });

      // 클라이언트 연결 종료 처리
      res.on('close', () => {
        stream.destroy();
      });
    } catch (error) {
      console.error('Streaming query error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          status: 'error',
          message: error.message || 'Failed to execute streaming query',
        });
      }
    }
  }
}
