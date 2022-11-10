import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableQuery } from './entity/table-query.entity';
import { Database } from '../../database/entities/database.entity';

@Injectable()
export class TableQueryService {
  constructor(
    @InjectRepository(TableQuery)
    private tableQueryRepository: Repository<TableQuery>,
    @InjectRepository(Database)
    private databaseRepository: Repository<Database>,
  ) {}

  /**
   * tableQuery 생성
   * @param databaseId
   * @param tableName
   */
  async create(databaseId: number, tableName: string) {
    const selectQuery = await this.makeSelectAllQuery(databaseId, tableName);

    return await this.tableQueryRepository.save({
      databaseId,
      query: selectQuery,
    });
  }

  async makeSelectAllQuery(databaseId: number, tableName: string) {
    const databaseOne = await this.databaseRepository.findOne({ where: { id: databaseId } });
    let selectQuery;
    switch (databaseOne.type) {
      case 'bigquery':
        const schemaName = JSON.parse(databaseOne.connectionConfig).connection.schema;
        selectQuery = `SELECT * FROM ${schemaName}.${tableName}`;
        break;
      case 'oracle':
        selectQuery = `SELECT * FROM "${tableName}"`;
        break;
      default:
        selectQuery = `SELECT * FROM ${tableName}`;
        break;
    }

    return selectQuery;
  }

  /**
   * tableQuery 삭제
   * @param id
   */
  async remove(id: number) {
    const tableQuery = await this.tableQueryRepository.findOne({ where: { id: id } });
    if (!tableQuery) {
      return 'No exist';
    } else {
      await this.tableQueryRepository.delete(tableQuery.id);
    }

    return `This action removes a #${id} widgetView`;
  }
}
