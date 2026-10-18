import { metadataTransaction } from '../../common/metadata-work';
import { lockMetricSources } from '../../metric/metric-write-lock';
import { lockSourceActor, assertSourceOwner } from '../../database/source-write-lock';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TableQuery } from './entity/table-query.entity';
import { Database } from '../../database/entities/database.entity';
import { decryptConnectionConfig } from '../../utils/crypto.util';
import { assertSafeIdentifier } from '../../utils/query-guard.util';

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
  async create(
    databaseId: number,
    tableName: string,
    actor?: number,
    epoch?: number,
    manager?: EntityManager,
  ) {
    const write = async (tx: EntityManager) => {
      if (!manager) await lockSourceActor(tx, actor, epoch);
      const source = (await lockMetricSources(tx, [databaseId])).get(databaseId);
      assertSourceOwner(source, actor);
      const selectQuery = await this.makeSelectAllQuery(databaseId, tableName, tx);
      return tx.save(TableQuery, { databaseId, query: selectQuery });
    };
    return manager ? write(manager) : metadataTransaction(this.tableQueryRepository.manager, write);
  }

  async makeSelectAllQuery(
    databaseId: number,
    tableName: string,
    manager = this.databaseRepository.manager,
  ) {
    assertSafeIdentifier(tableName);
    const databaseOne = await manager.findOne(Database, { where: { id: databaseId } });
    let selectQuery;
    switch (databaseOne.type) {
      case 'bigquery':
        const schemaName = JSON.parse(decryptConnectionConfig(databaseOne.connectionConfig))
          .connection.schema;
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
