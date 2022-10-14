import { Injectable } from '@nestjs/common';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { Repository } from 'typeorm';
import { ConnectionService } from '../connection/connection.service';
import { Dataset } from '../dataset/entities/dataset.entity';
import { ResponseStatus } from '../common/enum/response-status.enum';

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    @InjectRepository(Dataset) private datasetRepository: Repository<Dataset>,
    private readonly connectionService: ConnectionService,
  ) {}

  async create(createDatabaseDto: CreateDatabaseDto): Promise<Database> {
    const databaseDto = Database.toDto(createDatabaseDto);
    databaseDto.connectionConfig = JSON.stringify(databaseDto.connectionConfig);
    return await this.databaseRepository.save(databaseDto);
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
    databaseInfo.connectionConfig = JSON.parse(databaseInfo.connectionConfig);

    // table 정보 조회
    const tablesInfo = await this.connectionService.executeQuery({ id: +id, query: 'show tables' });
    const tables = [];
    if (tablesInfo && tablesInfo.datas.length > 0) {
      tablesInfo.datas.map(tableObj => {
        tables.push({ id: Object.values(tableObj)[0], data: Object.values(tableObj)[0] });
      });
    }

    // dataset 정보 조회
    const datasets = await this.datasetRepository.find({ where: { databaseId: id } });

    return { status: ResponseStatus.SUCCESS, data: { databaseInfo, tables, datasets } };
  }

  /**
   * db config 정보 단순 조회
   * @param id
   */
  async findDB(id: number) {
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    databaseInfo.connectionConfig = JSON.parse(databaseInfo.connectionConfig);
    return { status: ResponseStatus.SUCCESS, data: databaseInfo };
  }

  async update(id: number, updateDatabaseDto: UpdateDatabaseDto) {
    const one = await this.findOne(id);
    if (!one)
      return {
        status: ResponseStatus.ERROR,
        message: `조건에 맞는 데이터베이스를 찾지 못했습니다. id:${id}`,
      };
    one.name = updateDatabaseDto.name;
    const saveResult = await this.databaseRepository.save(one);
    return { status: ResponseStatus.SUCCESS, data: saveResult };
  }

  async remove(id: number) {
    const one = await this.findOne(id);
    if (!one)
      return {
        status: ResponseStatus.ERROR,
        message: `조건에 맞는 데이터베이스를 찾지 못했습니다. id:${id}`,
      };
    await this.databaseRepository.remove(one);
    return { status: ResponseStatus.SUCCESS };
  }
}
