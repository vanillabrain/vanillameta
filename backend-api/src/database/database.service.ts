import { Injectable } from '@nestjs/common';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { Repository } from 'typeorm';
import { ConnectionService } from '../connection/connection.service';
import { Dataset } from '../dataset/entities/dataset.entity';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { QueryExecuteDto } from './dto/query-execute.dto';
import {DatabaseType} from "./entities/database_type.entity";
import {YesNo} from "../common/enum/yn.enum";

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    @InjectRepository(DatabaseType) private databaseTypeRepository: Repository<DatabaseType>,
    @InjectRepository(Dataset) private datasetRepository: Repository<Dataset>,
    @InjectRepository(TableQuery) private tableQueryRepository: Repository<TableQuery>,
    private readonly connectionService: ConnectionService,
  ) {}

  /**
   * database type 목록 조회
   */
  async findTypeList(){
    const result = await this.databaseTypeRepository.find({where:{useYn:YesNo.YES}});
    return { status: ResponseStatus.SUCCESS, data: result };
  }

  /**
   * database(데이터소스) 생성
   * @param createDatabaseDto
   */
  async create(createDatabaseDto: CreateDatabaseDto) {
    const databaseDto = Database.toDto(createDatabaseDto);

    const connectionConfig = {
      client: databaseDto.engine,
      connection: databaseDto.connectionConfig,
      useNullAsDefault: true,
    };
    databaseDto.connectionConfig = JSON.stringify(connectionConfig);
    databaseDto.timezone = 'Asia/Seoul';

    const saveResult = await this.databaseRepository.save(databaseDto);
    saveResult.connectionConfig = JSON.parse(saveResult.connectionConfig);
    return { status: ResponseStatus.SUCCESS, data: saveResult };
  }

  /**
   * database 목록 조회
   */
  async findAll() {
    const result = await this.databaseRepository.find();
    result.forEach(db => {
      db.connectionConfig = JSON.parse(db.connectionConfig);
    });
    return { status: ResponseStatus.SUCCESS, data: result };
  }

  /**
   * database 정보 조회
   * @param id
   */
  async findOne(id: number): Promise<any> {
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    databaseInfo.connectionConfig = JSON.parse(databaseInfo.connectionConfig).connection;

    // table 정보 조회
    const tablesInfo = await this.connectionService.executeQuery({ id: +id, query: 'show tables' });
    const tables = [];
    if (tablesInfo && tablesInfo.datas.length > 0) {
      tablesInfo.datas.map(tableObj => {
        tables.push({ id: Object.values(tableObj)[0], tableName: Object.values(tableObj)[0], databaseId: id, datasetType:DatasetType.TABLE });
      });
    }

    // dataset 정보 조회
    const tempDatasets = await this.datasetRepository.find({ where: { databaseId: id } });
    const datasets = [];
    tempDatasets.map(item => {
      datasets.push(Object.assign({datasetType:DatasetType.DATASET}, item));
    })

    return { status: ResponseStatus.SUCCESS, data: { databaseInfo, tables, datasets } };
  }

  /**
   * db config 정보 단순 조회
   * @param id
   */
  private async findDB(id: number) {
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    databaseInfo.connectionConfig = JSON.parse(databaseInfo.connectionConfig);
    return databaseInfo;
  }

  async update(id: number, updateDatabaseDto: UpdateDatabaseDto) {
    const one = await this.findDB(id);
    if (!one)
      return {
        status: ResponseStatus.ERROR,
        message: `조건에 맞는 데이터베이스를 찾지 못했습니다. id:${id}`,
      };

    const connectionConfig = {
      client: one.engine,
      connection: Object(one.connectionConfig).connection,
      useNullAsDefault: true,
    };
    updateDatabaseDto.connectionConfig = JSON.stringify(connectionConfig);

    const saveResult = await this.databaseRepository.update(
      { id },
      { name: updateDatabaseDto.name, connectionConfig: updateDatabaseDto.connectionConfig },
    );

    if (saveResult.affected === 1) {
      return { status: ResponseStatus.SUCCESS, data: { message: `${id} 수정 완료` } };
    } else {
      return { status: ResponseStatus.ERROR, message: '수정 실패' };
    }
  }

  async remove(id: number) {
    const one = await this.findDB(id);
    if (!one)
      return {
        status: ResponseStatus.ERROR,
        message: `조건에 맞는 데이터베이스를 찾지 못했습니다. id:${id}`,
      };
    await this.databaseRepository.remove(one);
    return { status: ResponseStatus.SUCCESS, data: { message: `${id} 삭제 완료` } };
  }

  /**
   * 데이터 조회
   * @param datasetType
   * @param datasetId
   */
  async findData(datasetType: DatasetType, datasetId: number) {
    if (!datasetType || !datasetId)
      return {
        status: ResponseStatus.ERROR,
        message: 'datasetType, datasetId는 필수 입력 param 입니다',
      };

    const queryExecuteDto = new QueryExecuteDto();
    if (datasetType === DatasetType.DATASET) {
      const datasetItem = await this.datasetRepository.findOne({ where: { id: datasetId } });
      queryExecuteDto.id = datasetItem.databaseId;
      queryExecuteDto.query = datasetItem.query;
    } else if (datasetType === DatasetType.TABLE) {
      const datasetItem = await this.tableQueryRepository.findOne({ where: { id: datasetId } });
      queryExecuteDto.id = datasetItem.databaseId;
      queryExecuteDto.query = datasetItem.query;
    }
    const queryResult = await this.connectionService.executeQuery(queryExecuteDto);
    return {
      status: queryResult.status,
      data: { datas: queryResult.datas, fields: queryResult.fields },
    };
  }
}
