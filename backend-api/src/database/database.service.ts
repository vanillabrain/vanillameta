import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { Repository } from 'typeorm';
import { ConnectionService } from './connection/connection.service';
import { Dataset } from '../dataset/entities/dataset.entity';

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    @Inject(forwardRef(() => ConnectionService)) private connectionService: ConnectionService,
    @InjectRepository(Dataset) private datasetRepository: Repository<Dataset>,
  ) {}

  async create(createDatabaseDto: CreateDatabaseDto): Promise<Database> {
    const databaseDto = Database.toDto(createDatabaseDto);
    databaseDto.connectionConfig = JSON.stringify(databaseDto.connectionConfig);
    return await this.databaseRepository.save(databaseDto);
  }

  async findAll(): Promise<Database[]> {
    const result = await this.databaseRepository.find();
    result.forEach(db => {
      db.connectionConfig = JSON.parse(db.connectionConfig);
    });
    return result;
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
        tables.push(Object.values(tableObj)[0]);
      });
    }

    // dataset 정보 조회
    const datasets = await this.datasetRepository.find({ where: { databaseId: id } });

    return { databaseInfo, tables, datasets };
  }

  /**
   * db config 정보 단순 조회
   * @param id
   */
  async findDB(id: number): Promise<Database> {
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    databaseInfo.connectionConfig = JSON.parse(databaseInfo.connectionConfig);
    return databaseInfo;
  }

  async update(id: number, updateDatabaseDto: UpdateDatabaseDto) {
    const one = await this.findOne(id);
    if (!one) throw new NotFoundException(`조건에 맞는 데이터베이스를 찾지 못했습니다. id:${id}`);
    one.name = updateDatabaseDto.name;
    return await this.databaseRepository.save(one);
  }

  async remove(id: number) {
    const one = await this.findOne(id);
    if (!one) throw new NotFoundException(`조건에 맞는 데이터베이스를 찾지 못했습니다. id:${id}`);
    return this.databaseRepository.remove(one);
  }
}
