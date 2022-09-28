import { Injectable } from '@nestjs/common';
import { CreateDatabaseDto } from '../dto/create-database.dto';
import { QueryExecuteDto } from '../dto/query-execute.dto';
import { DatabaseService } from '../database.service';
import { Knex, knex } from 'knex';

const knexConnections = new Map<number, Knex>();

@Injectable()
export class ConnectionService {
  constructor(private readonly databaseService: DatabaseService) {}

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
      const one = await this.databaseService.findOne(id);
      this.addKnex(id, one.knexConfig as Knex.Config);
    }
    return knexConnections.get(id);
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  async testConnection(createDatabaseDto: CreateDatabaseDto): Promise<boolean> {
    let _knex = knex(createDatabaseDto.knexConfig as Knex.Config);
    try {
      await _knex.raw('SELECT 1');
      console.log('knex connected');
      return true;
    } catch (e) {
      console.log('knex not connected');
      console.error(e);
      return false;
    } finally {
      await _knex.destroy();
    }
  }

  /**
   * 쿼리 실행
   * @param queryExecuteDto
   */
  async executeQuery(queryExecuteDto: QueryExecuteDto) {
    const knex = await this.getKnex(queryExecuteDto.id);
    return knex.raw(queryExecuteDto.query);
  }
}
