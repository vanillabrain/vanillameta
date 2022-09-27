import { Injectable } from '@nestjs/common';
import { CreateDatabaseDto } from '../dto/create-database.dto';
import { QueryExecuteDto } from '../dto/query-execute.dto';
import { KnexOptions } from '@nestjsplus/knex';

const Knex = require('knex');
const knexConnections = new Map<string, any>();

@Injectable()
export class ConnectionService {
  addKnex(name: string, options: KnexOptions) {
    if (!this.hasKnex(name)) {
      knexConnections.set(name, new Knex(options));
    }
  }

  removeKnex(name: string) {
    knexConnections.delete(name);
  }

  hasKnex(name: string): boolean {
    return knexConnections.has(name);
  }

  getKnex(name: string) {
    return knexConnections.get(name);
  }

  async testConnection(createDatabaseDto: CreateDatabaseDto) {}

  async executeQuery(queryExecuteDto: QueryExecuteDto) {}
}
