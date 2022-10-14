import { Injectable } from '@nestjs/common';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dataset } from './entities/dataset.entity';
import { ConnectionService } from '../connection/connection.service';
import { ResponseStatus } from '../common/enum/response-status.enum';

@Injectable()
export class DatasetService {
  constructor(
    @InjectRepository(Dataset)
    private datasetRepository: Repository<Dataset>,
    private readonly connectionService: ConnectionService,
  ) {}

  /**
   * 데이터셋 추가
   * @param createDatasetDto
   */
  async create(createDataset: CreateDatasetDto) {
    // 쿼리를 돌려보고 문제가 있으면 저장 불가 안내
    const queryResult = await this.connectionService.executeQuery({
      id: createDataset.databaseId,
      query: createDataset.query,
    });
    if (queryResult.status === ResponseStatus.ERROR) {
      return { status: ResponseStatus.ERROR, message: queryResult.message };
    }

    // 쿼리에 문제가 없으면 저장
    return {
      status: ResponseStatus.SUCCESS,
      data: await this.datasetRepository.save(createDataset),
    };
  }

  /**
   * 데이터셋 전체 조회
   */
  async findAll() {
    return await this.datasetRepository.find();
  }

  /**
   * 데이터셋 단건 조회
   * @param id
   */
  async findOne(id: number) {
    let returnObj: any;
    const dataObj = await this.datasetRepository.findOne({ where: { id: id } });

    if (!dataObj) returnObj = {status: ResponseStatus.ERROR, message: `id ${id}의 값이 존재하지 않습니다.`};
    else returnObj = {status:ResponseStatus.SUCCESS, data: dataObj};
    return returnObj;
  }

  async update(id: number, updateDataset: UpdateDatasetDto) {
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });
    if (!find_dataset) {
      return { status: ResponseStatus.ERROR, message: 'No exist dataset' };
    } else {
      // 변경할 쿼리 날려보고, 문제 없으면 저장
      const queryResult = await this.connectionService.executeQuery({
        id: find_dataset.databaseId,
        query: updateDataset.query,
      });
      if (queryResult.status === ResponseStatus.ERROR) {
        return { status: ResponseStatus.ERROR, message: queryResult.message };
      } else {
        if (updateDataset.title) {
          find_dataset.title = updateDataset.title;
        }
        if (updateDataset.query) {
          find_dataset.query = updateDataset.query;
        }

        const saveResult = await this.datasetRepository.save(find_dataset);
        return { status: ResponseStatus.SUCCESS, data: saveResult };
      }
    }
  }

  async remove(id: number) {
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });

    if (!find_dataset) {
      return 'Not exist dataset';
    } else {
      await this.datasetRepository.delete(find_dataset.id);
    }
    return `This action removes a #${id} dataset`;
  }
}
