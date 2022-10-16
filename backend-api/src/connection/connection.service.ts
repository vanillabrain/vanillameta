import { Injectable } from '@nestjs/common';
import { CreateDatabaseDto } from '../database/dto/create-database.dto';
import { QueryExecuteDto } from '../database/dto/query-execute.dto';
import { Knex, knex } from 'knex';
import { FieldTypeUtil } from '../utils/field-type.util';
import { Database } from '../database/entities/database.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseStatus } from '../common/enum/response-status.enum';

const knexConnections = new Map<number, Knex>();

@Injectable()
export class ConnectionService {
  constructor(@InjectRepository(Database) private databaseRepository: Repository<Database>) {}

  /**
   * Knex 객체 생성 후 pool에 추가
   * @param id
   * @param options
   */
  addKnex(id: number, options: Knex.Config) {
    if (!this.hasKnex(id)) {
      knexConnections.set(id, knex(options));
    }
  }

  /**
   * Knex 객체 pool에서 삭제
   * @param id
   */
  removeKnex(id: number) {
    knexConnections.delete(id);
  }

  /**
   * Knex 객체 pool 안에 존재 유무
   * @param id
   */
  hasKnex(id: number): boolean {
    return knexConnections.has(id);
  }

  /**
   * Knex 객체 가져오기 - 만약 없으면 가져오기
   * @param id
   * @param databaseInfo
   */
  async getKnex(id: number): Promise<Knex> {
    if (!this.hasKnex(id)) {
      const one = await this.databaseRepository.findOne({ where: { id: id } });
      one.connectionConfig = JSON.parse(one.connectionConfig);
      this.addKnex(id, one.connectionConfig as Knex.Config);
    }
    return knexConnections.get(id);
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  async testConnection(createDatabaseDto: CreateDatabaseDto) {
    const connectionConfig = {
      client: createDatabaseDto.engine,
      connection: createDatabaseDto.connectionConfig,
      useNullAsDefault: true,
    };
    createDatabaseDto.connectionConfig = JSON.stringify(connectionConfig);

    let _knex: Knex;
    let returnObj = {};
    try {
      _knex = knex(connectionConfig as Knex.Config);
    } catch (e) {
      console.log('knex not connected');
      console.error(e);
      return { status: ResponseStatus.ERROR, message: 'knex not connected' };
    }

    try {
      await _knex.raw('SELECT 1');
      returnObj = { status: ResponseStatus.SUCCESS, data: { message: 'success' } };
    } catch (e) {
      console.log(e);
      returnObj = { status: ResponseStatus.ERROR, message: e.sqlMessage };
    } finally {
      await _knex.destroy();
    }

    return returnObj;
  }

  /**
   * 쿼리 실행
   * @param queryExecuteDto
   */
  async executeQuery(queryExecuteDto: QueryExecuteDto) {
    const knex = await this.getKnex(queryExecuteDto.id);

    let datas = [];
    const fields = [];
    const resultObj = { status: ResponseStatus.SUCCESS, message: 'success', datas: [], fields: [] };

    try {
      const queryRes = await knex.raw(queryExecuteDto.query);

      switch (knex.client.config.client) {
        case 'mysql':
          if (queryRes && queryRes.length > 0) {
            datas = queryRes[0];
            const tempFields = queryRes[1];
            tempFields.map(field => {
              const fieldInfo = {
                name: field.name,
                length: field.length,
                type: FieldTypeUtil.mysqlFieldType(field.type),
              };
              fields.push(fieldInfo);
            });
          }
      }

      resultObj.datas = datas;
      resultObj.fields = fields;
    } catch (e) {
      resultObj.status = ResponseStatus.ERROR;
      resultObj.message = e.sqlMessage;
      console.log(e);
      console.log(e.sqlMessage);
    }

    return resultObj;
  }
}
