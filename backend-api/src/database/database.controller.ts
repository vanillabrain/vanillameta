import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { QueryExecuteDto } from './dto/query-execute.dto';
import { ConnectionService } from './connection/connection.service';

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

  @Get()
  async findAll() {
    const resultList = await this.databaseService.findAll();

    resultList.forEach(db => {
      db.knexConfig = JSON.parse(db.knexConfig);
    });
    return resultList;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const resultDB = await this.databaseService.findOne(+id);
    resultDB.knexConfig = JSON.parse(resultDB.knexConfig);
    return resultDB;
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
