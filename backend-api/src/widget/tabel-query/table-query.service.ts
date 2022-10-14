import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableQuery } from './entity/table-query.entity';

@Injectable()
export class TableQueryService {
  constructor(
    @InjectRepository(TableQuery)
    private tableQueryRepository: Repository<TableQuery>,
  ) {}

  /**
   * tableQuery 생성
   * @param databaseId
   * @param tableName
   */
  async create(databaseId: number, tableName: string) {
    return await this.tableQueryRepository.save({
      databaseId,
      query: `SELECT * FROM ${tableName}`,
    });
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
