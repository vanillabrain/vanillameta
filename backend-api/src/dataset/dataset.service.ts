import { Injectable } from '@nestjs/common';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dataset } from './entities/dataset.entity';

@Injectable()
export class DatasetService {
  constructor(
    @InjectRepository(Dataset)
    private datasetRepository: Repository<Dataset>,
  ) {}

  /**
   * 데이터셋 추가
   * @param createDatasetDto
   */
  async create(createDataset: CreateDatasetDto) {
    const saveObj: CreateDatasetDto = new CreateDatasetDto();
    saveObj.title = createDataset.title;
    saveObj.query = createDataset.query;
    saveObj.databaseId = createDataset.databaseId;

    return await this.datasetRepository.save(createDataset);
  }

  async findAll() {
    return await this.datasetRepository.find();
  }

  async findOne(id: number) {
    let returnObj: any;
    returnObj = await this.datasetRepository.findOne({ where: { id: id } });

    if (!returnObj) returnObj = {};

    return returnObj;
  }

  async update(id: number, updateDataset: UpdateDatasetDto) {
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });
    if (!find_dataset) {
      return 'No exist widget';
    } else {
      if (updateDataset.databaseId) {
        find_dataset.databaseId = updateDataset.databaseId;
      }
      if (updateDataset.title) {
        find_dataset.title = updateDataset.title;
      }
      if (updateDataset.query) {
        find_dataset.query = updateDataset.query;
      }

      await this.datasetRepository.save(find_dataset);
      return `This action updates a #${id} dataset`;
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
