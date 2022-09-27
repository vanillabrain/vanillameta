import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { Repository } from 'typeorm';
import { QueryExecuteDto } from './dto/query-execute.dto';

@Injectable()
export class DatabaseService {
  constructor(@InjectRepository(Database) private databaseRepository: Repository<Database>) {}

  getHello() {
    return 'Hello';
  }

  async create(createDatabaseDto: CreateDatabaseDto): Promise<Database> {
    const database = Database.toDto(createDatabaseDto);
    return await this.databaseRepository.save(database);
  }

  async testConnection(createDatabaseDto: CreateDatabaseDto) {}

  async executeQuery(queryExecuteDto: QueryExecuteDto) {}

  async findAll(): Promise<Database[]> {
    return await this.databaseRepository.find();
  }

  async findOne(id: number): Promise<Database> {
    return await this.databaseRepository.findOne({ where: { id } });
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
