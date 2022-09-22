import { Injectable } from '@nestjs/common';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';

@Injectable()
export class DatasetService {
  create(createDatasetDto: CreateDatasetDto) {
    return 'This action adds a new dataset';
  }

  findAll() {
    return `This action returns all dataset`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dataset`;
  }

  update(id: number, updateDatasetDto: UpdateDatasetDto) {
    return `This action updates a #${id} dataset`;
  }

  remove(id: number) {
    return `This action removes a #${id} dataset`;
  }
}
