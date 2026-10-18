import { metadataTransaction } from '../common/metadata-work';
import { lockMetricSources } from '../metric/metric-write-lock';
import {
  lockSourceActor,
  assertSourceOwner,
  sourceWriteFields,
} from '../database/source-write-lock';
import { Database } from '../database/entities/database.entity';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dataset } from './entities/dataset.entity';
import { ConnectionService } from '../connection/connection.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { Widget } from '../widget/entities/widget.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';

@Injectable()
export class DatasetService {
  constructor(
    @InjectRepository(Dataset)
    private datasetRepository: Repository<Dataset>,
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
    private readonly connectionService: ConnectionService,
  ) {}

  /**
   * 데이터셋 추가
   * @param createDatasetDto
   */
  async create(createDataset: CreateDatasetDto, actor?: number, epoch?: number) {
    createDataset = sourceWriteFields(createDataset, ['title', 'databaseId', 'query']);
    // The existing Source Select submits decimal strings. Normalize at the request boundary;
    // parent-lock helpers continue to require canonical positive numeric IDs.
    const rawSourceId: unknown = createDataset.databaseId;
    const sourceId =
      typeof rawSourceId === 'string' && /^[1-9]\d*$/.test(rawSourceId)
        ? Number(rawSourceId)
        : rawSourceId;
    if (typeof sourceId !== 'number' || !Number.isSafeInteger(sourceId) || sourceId <= 0)
      throw new BadRequestException('invalid database id');
    createDataset = { ...createDataset, databaseId: sourceId };
    const basis = await this.datasetRepository.manager.findOne(Database, {
      where: { id: createDataset.databaseId },
    });
    assertSourceOwner(basis, actor);
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
      data: await metadataTransaction(this.datasetRepository.manager, async manager => {
        await lockSourceActor(manager, actor, epoch);
        const source = (await lockMetricSources(manager, [createDataset.databaseId])).get(
          createDataset.databaseId,
        );
        assertSourceOwner(source, actor);
        if (JSON.stringify(source) !== JSON.stringify(basis))
          throw new ConflictException('Source changed.');
        return manager.save(Dataset, createDataset);
      }),
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

    if (!dataObj)
      returnObj = { status: ResponseStatus.ERROR, message: `id ${id}의 값이 존재하지 않습니다.` };
    else returnObj = { status: ResponseStatus.SUCCESS, data: dataObj };
    return returnObj;
  }

  async update(id: number, updateDataset: UpdateDatasetDto, actor?: number, epoch?: number) {
    updateDataset = sourceWriteFields(updateDataset, ['title', 'query']);
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });
    if (!find_dataset) {
      return { status: ResponseStatus.ERROR, message: 'No exist dataset' };
    } else {
      const basis = await this.datasetRepository.manager.findOne(Database, {
        where: { id: find_dataset.databaseId },
      });
      assertSourceOwner(basis, actor);
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

        const saveResult = await metadataTransaction(
          this.datasetRepository.manager,
          async manager => {
            await lockSourceActor(manager, actor, epoch);
            const source = (await lockMetricSources(manager, [find_dataset.databaseId])).get(
              find_dataset.databaseId,
            );
            assertSourceOwner(source, actor);
            if (JSON.stringify(source) !== JSON.stringify(basis))
              throw new ConflictException('Source changed.');
            const current = await manager.findOne(Dataset, { where: { id } });
            if (!current || current.databaseId !== find_dataset.databaseId)
              throw new ConflictException('Dataset source changed.');
            if (updateDataset.title) current.title = updateDataset.title;
            if (updateDataset.query) current.query = updateDataset.query;
            return manager.save(Dataset, current);
          },
        );
        return { status: ResponseStatus.SUCCESS, data: saveResult };
      }
    }
  }

  async remove(id: number) {
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });

    if (!find_dataset) {
      return { status: ResponseStatus.ERROR, message: 'No exist dataset' };
    } else {
      await this.datasetRepository.delete(find_dataset.id);
      await this.widgetRepository.delete({
        datasetType: DatasetType.DATASET,
        datasetId: find_dataset.id,
      });
    }
    return `This action removes a #${id} dataset`;
  }
}
