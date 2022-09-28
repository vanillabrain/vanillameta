import {Injectable} from '@nestjs/common';
import {CreateDatasetDto} from './dto/create-dataset.dto';
import {UpdateDatasetDto} from './dto/update-dataset.dto';
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {Dataset} from "@google-cloud/bigquery";

@Injectable()
export class DatasetService {
    constructor(
        @InjectRepository(Dataset)
        private readonly datasetRepository: Repository<Dataset>
    ) {
    }

    /**
     * 데이터셋 추가
     * @param createDatasetDto
     */
    async create(createDatasetDto: CreateDatasetDto) {
        return await this.datasetRepository.save(createDatasetDto);
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
