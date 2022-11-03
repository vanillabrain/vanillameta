import { Injectable } from '@nestjs/common';
import { CreateDatabaseDto } from '../database/dto/create-database.dto';
import { QueryExecuteDto } from '../database/dto/query-execute.dto';
import { Knex, knex } from 'knex';
import { FieldTypeUtil } from '../utils/field-type.util';
import { Database } from '../database/entities/database.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseStatus } from '../common/enum/response-status.enum';
const { BigQueryClient } = require('knex-bigquery');

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
   */
  async getKnex(id: number): Promise<Knex> {
    if (!this.hasKnex(id)) {
      const one = await this.databaseRepository.findOne({ where: { id: id } });
      one.connectionConfig = JSON.parse(one.connectionConfig);
      const knexConfig = one.connectionConfig;
      if (knexConfig['client'] == 'bigquery') {
        knexConfig['client'] = BigQueryClient;
      }
      this.addKnex(id, one.connectionConfig as Knex.Config);
    }
    return knexConnections.get(id);
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  async testConnection(createDatabaseDto: CreateDatabaseDto) {
    const engine =
      createDatabaseDto.engine === 'bigquery' ? BigQueryClient : createDatabaseDto.engine;
    const connectionConfig = {
      client: engine,
      connection: createDatabaseDto.connectionConfig,
      useNullAsDefault: true,
    };
    // createDatabaseDto.connectionConfig = JSON.stringify(connectionConfig);
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
    const resultObj = { status: null, message: null, datas: [], fields: [] };

    try {
      const queryRes = await knex.raw(queryExecuteDto.query);

      switch (knex.client.config.client) {
        case 'mysql2':
          if (queryRes && queryRes[0].length > 0) {
            datas = queryRes[0];
            const tempFields = queryRes[1];
            tempFields.map(field => {
              const fieldInfo = {
                columnName: field.name,
                columnType: FieldTypeUtil.mysqlFieldType(field.columnType),
              };
              fields.push(fieldInfo);
            });
          }
          break;

        case 'pg':
          if (queryRes && queryRes.rows.length > 0) {
            datas = queryRes.rows;
            const tempFields = queryRes.fields;
            tempFields.map(field => {
              const length = [];
              const maxCnt = queryRes.rows.length > 100 ? 100 : queryRes.rows.length;
              for (let i = 0; i < maxCnt; i++) {
                length.push(queryRes.rows[i][field.name]);
              }
              const fieldInfo = {
                columnName: field.name,
                columnType: FieldTypeUtil.FieldType(length),
              };
              fields.push(fieldInfo);
            });
          }
          break;

        case 'Db2Dialect':
          if (queryRes && queryRes.length > 0) {
            datas = queryRes;

            // for (let i = 0; i < Object.keys(queryRes[0]).length; i++) {
            //   console.log(Object.keys[i]);
            // }
            const tempFields = queryRes;
            tempFields.map(field => {
              const fieldInfo = {
                columnName: field.name,
                columnLength: field.length,
                columnType: FieldTypeUtil.mysqlFieldType(field.type),
              };
              fields.push(fieldInfo);
            });
          }
          break;

        // case 'sqlite3':
        // case 'bigquery':
        // case 'mssql
        default:
          if (queryRes && queryRes.length > 0) {
            datas = queryRes;
            const tempFields = Object.keys(queryRes[0]);
            tempFields.map(field => {
              const length = [];
              const maxCnt = queryRes.length > 100 ? 100 : queryRes.length;
              for (let i = 0; i < maxCnt; i++) {
                length.push(queryRes[i][field]);
              }
              const fieldInfo = {
                columnName: field,
                columnType: FieldTypeUtil.FieldType(length),
              };
              fields.push(fieldInfo);
            });
          }
          break;
      }

      resultObj.status = ResponseStatus.SUCCESS;
      resultObj.message = 'success';
      resultObj.datas = datas;
      resultObj.fields = fields;
    } catch (e) {
      resultObj.status = ResponseStatus.ERROR;
      if (e.sqlMessage) resultObj.message = e.sqlMessage;
      else if (e.message) resultObj.message = e.message; // bigquery
      console.log(e);
    }

    return resultObj;
  }
}
