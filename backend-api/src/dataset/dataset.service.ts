import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateDatasetDto } from './dto/create-dataset.dto';
import { UpdateDatasetDto } from './dto/update-dataset.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Dataset } from './entities/dataset.entity';
import { ConnectionService } from '../connection/connection.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { Widget } from '../widget/entities/widget.entity';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { Database } from '../database/entities/database.entity';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../common/enum/role.enum';

@Injectable()
export class DatasetService {
  constructor(
    @InjectRepository(Dataset)
    private datasetRepository: Repository<Dataset>,
    @InjectRepository(Widget)
    private widgetRepository: Repository<Widget>,
    @InjectRepository(Database)
    private databaseRepository: Repository<Database>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly connectionService: ConnectionService,
  ) {}

  /**
   * 부모 데이터소스 소유자/관리자 검증. userId 미지정(내부 호출)이면 통과.
   */
  private async assertDatabaseAccess(databaseId: number, userId?: number) {
    if (userId === undefined) return;

    const database = await this.databaseRepository.findOne({ where: { id: databaseId } });
    if (!database) {
      throw new HttpException('database not found', HttpStatus.NOT_FOUND);
    }
    if (database.ownerId === userId) return;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user?.role === UserRole.ADMIN) return;

    throw new HttpException('forbidden', HttpStatus.FORBIDDEN);
  }

  /** 접근 가능한 데이터소스 id 목록. null 이면 필터 없음(관리자/내부 호출). */
  private async accessibleDatabaseIds(userId?: number): Promise<number[] | null> {
    if (userId === undefined) return null;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user?.role === UserRole.ADMIN) return null;
    const databases = await this.databaseRepository.find({ where: { ownerId: userId } });
    return databases.map(database => database.id);
  }

  /**
   * 데이터셋 추가
   * @param createDatasetDto
   */
  async create(createDataset: CreateDatasetDto, userId?: number) {
    await this.assertDatabaseAccess(createDataset.databaseId, userId);
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
  async findAll(userId?: number) {
    const ids = await this.accessibleDatabaseIds(userId);
    if (ids !== null && ids.length === 0) return [];
    return await this.datasetRepository.find(ids === null ? {} : { where: { databaseId: In(ids) } });
  }

  /**
   * 데이터셋 단건 조회
   * @param id
   */
  async findOne(id: number, userId?: number) {
    let returnObj: any;
    const dataObj = await this.datasetRepository.findOne({ where: { id: id } });

    if (!dataObj) {
      returnObj = { status: ResponseStatus.ERROR, message: `id ${id}의 값이 존재하지 않습니다.` };
    } else {
      await this.assertDatabaseAccess(dataObj.databaseId, userId);
      returnObj = { status: ResponseStatus.SUCCESS, data: dataObj };
    }
    return returnObj;
  }

  async update(id: number, updateDataset: UpdateDatasetDto, userId?: number) {
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });
    if (!find_dataset) {
      return { status: ResponseStatus.ERROR, message: 'No exist dataset' };
    } else {
      await this.assertDatabaseAccess(find_dataset.databaseId, userId);
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

  async remove(id: number, userId?: number) {
    const find_dataset = await this.datasetRepository.findOne({ where: { id: id } });

    if (!find_dataset) {
      return 'Not exist dataset';
    } else {
      await this.assertDatabaseAccess(find_dataset.databaseId, userId);
      await this.datasetRepository.delete(find_dataset.id);
      await this.widgetRepository.delete({
        datasetType: DatasetType.DATASET,
        datasetId: find_dataset.id,
      });
    }
    return `This action removes a #${id} dataset`;
  }
}
