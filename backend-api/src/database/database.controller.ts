import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { QueryExecuteDto } from './dto/query-execute.dto';
import { ConnectionService } from '../connection/connection.service';

@Controller('database')
export class DatabaseController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly connectionService: ConnectionService,
  ) {}

  @Post()
  create(@Body() createDatabaseDto: CreateDatabaseDto) {
    return this.databaseService.create(createDatabaseDto);
  }

  @Post('test')
  testConnection(@Body() createDatabaseDto: CreateDatabaseDto) {
    return this.connectionService.testConnection(createDatabaseDto);
  }

  @Post('execute')
  executeQuery(@Body() queryExecuteDto: QueryExecuteDto) {
    return this.connectionService.executeQuery(queryExecuteDto);
  }

  /**
   * 데이터베이스 목록 조회
   */
  @Get()
  async findAll() {
    const resultList = await this.databaseService.findAll();
    return resultList;
  }

  /**
   * 데이터베이스 상세 조회 - 데이터베이스 연결정보, 테이블, 데이터셋 조회
   * @param id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const databaseInfo = await this.databaseService.findOne(+id);
    return databaseInfo;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDatabaseDto: UpdateDatabaseDto) {
    return this.databaseService.update(+id, updateDatabaseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.databaseService.remove(+id);
  }
}
