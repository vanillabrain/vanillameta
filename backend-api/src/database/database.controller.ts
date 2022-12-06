import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { QueryExecuteDto } from './dto/query-execute.dto';
import { ConnectionService } from '../connection/connection.service';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';



@Controller('database')
export class DatabaseController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly connectionService: ConnectionService,
  ) {}

  /**
   * database type 목록 조회
   */
  @UseGuards(JwtAuthGuard)
  @Get('/type')
  findTypeList() {
    return this.databaseService.findTypeList();
  }
  @UseGuards(LocalAuthGuard)
  @Get('/data')
  async findData(
    @Query('datasetType') datasetType: DatasetType,
    @Query('databaseId') databaseId: number,
    @Query('datasetId') datasetId?: number,
    @Query('tableName') tableName?: string,
  ) {
    const res = await this.databaseService.findData(datasetType, databaseId, datasetId, tableName);
    return res;
  }

  /**
   * 데이터베이스 연결정보 단순조회
   * @param id
   */
  @UseGuards(JwtAuthGuard)
  @Get('/info/:id')
  async findOneInfo(@Param('id') id: string) {
    const databaseInfo = await this.databaseService.findOneInfo(+id);
    return databaseInfo;
  }

  /**
   * 데이터베이스 생성 ( 데이터소스 생성)
   * @param createDatabaseDto
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createDatabaseDto: CreateDatabaseDto) {
    return this.databaseService.create(createDatabaseDto);
  }

  /**
   * 데이터베이스 연결 테스트
   * @param createDatabaseDto
   */
  @Post('test')
  testConnection(@Body() createDatabaseDto: CreateDatabaseDto) {
    return this.connectionService.testConnection(createDatabaseDto);
  }

  /**
   * 쿼리 실행
   * @param queryExecuteDto
   */
  @Post('execute')
  executeQuery(@Body() queryExecuteDto: QueryExecuteDto) {
    return this.connectionService.executeQuery(queryExecuteDto);
  }

  /**
   * 데이터베이스 목록 조회
   */
  @Get()
  async findAll() {
    const res = await this.databaseService.findAll();
    return res;
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

  /**
   * database update
   * @param id
   * @param updateDatabaseDto
   */
  @Put(':id')
  update(@Param('id') id: string, @Body() updateDatabaseDto: UpdateDatabaseDto) {
    return this.databaseService.update(+id, updateDatabaseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.databaseService.remove(+id);
  }
}
