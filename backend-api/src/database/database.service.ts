import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { YesNo } from '../common/enum/yn.enum';
import { ConnectionService } from '../connection/connection.service';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/table-query/entity/table-query.entity';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { QueryExecuteDto } from './dto/query-execute.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { Database } from './entities/database.entity';
import { DatabaseType } from './entities/database_type.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class DatabaseService {
  private readonly DB_TYPES_CACHE_KEY = 'database:types:all';
  private readonly DB_TYPES_CACHE_TTL = 86400; // 24시간

  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    @InjectRepository(DatabaseType) private databaseTypeRepository: Repository<DatabaseType>,
    @InjectRepository(Dataset) private datasetRepository: Repository<Dataset>,
    @InjectRepository(TableQuery) private tableQueryRepository: Repository<TableQuery>,
    private readonly connectionService: ConnectionService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * database type list 조회 (캐싱 적용)
   */
  async findAllDbTypes() {
    // 캐시에서 조회
    const cachedTypes = await this.cacheManager.get(this.DB_TYPES_CACHE_KEY);
    if (cachedTypes) {
      return cachedTypes;
    }

    // DB에서 조회
    const dbTypes = await this.databaseTypeRepository.find({ order: { seq: 'ASC' } });
    
    // 캐시에 저장
    await this.cacheManager.set(this.DB_TYPES_CACHE_KEY, dbTypes, this.DB_TYPES_CACHE_TTL);
    
    return dbTypes;
  }

  /**
   * database(데이터소스) 생성
   * @param createDatabaseDto
   */
  async create(createDatabaseDto: CreateDatabaseDto) {
    const databaseDto = Database.toDto(createDatabaseDto);
    // connectionConfig 파싱
    let parsedConnectionConfig: any = databaseDto.connectionConfig;
    if (typeof parsedConnectionConfig === 'string') {
      try {
        parsedConnectionConfig = JSON.parse(parsedConnectionConfig);
      } catch (e) {
        parsedConnectionConfig = {};
      }
    }

    // SQLite 특별 처리
    let connectionConfig;
    if (databaseDto.engine === 'sqlite' || databaseDto.engine === 'better-sqlite3') {
      connectionConfig = {
        client: databaseDto.engine,
        connection: {
          filename: parsedConnectionConfig.database || './demo.db',
        },
        useNullAsDefault: true,
      };
    } else {
      connectionConfig = {
        client: databaseDto.engine,
        connection: parsedConnectionConfig,
        useNullAsDefault: true,
      };
    }
    if (connectionConfig.client === 'cockroachdb') {
      const connectioninfo = connectionConfig.connection;
      const cockroach_url = `postgresql://${connectioninfo['user']}:${connectioninfo['password']}@${connectioninfo['host']}:${connectioninfo['port']}/${connectioninfo['database']}?sslmode=verify-full&options=--cluster%3Dvanillameta-cockroach-3010`;
      connectioninfo['connectionString'] = cockroach_url;
    }

    databaseDto.connectionConfig = JSON.stringify(connectionConfig);
    databaseDto.timezone = 'Asia/Seoul';

    return this.databaseRepository.save(databaseDto);
  }

  /**
   * database 목록 조회
   */
  findAll() {
    return this.databaseRepository.find();
  }

  /**
   * database 정보 조회
   * @param id
   */
  async findOne(id: number): Promise<any> {
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    const parsedConfig = JSON.parse(databaseInfo.connectionConfig);
    databaseInfo.connectionConfig = parsedConfig.connection || parsedConfig;

    // table 정보 조회
    console.log('Database engine:', databaseInfo.engine);
    console.log('Database info:', databaseInfo);
    let selectTableQuery;
    switch (databaseInfo.engine) {
      case 'mysql2':
        selectTableQuery = 'SHOW TABLES';
        break;
      case 'pg':
        selectTableQuery = `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
        break;
      case 'sqlite':
        selectTableQuery = `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
        break;
      case 'sqlite3':
        selectTableQuery = `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
        break;
      case 'better-sqlite3':
        selectTableQuery = `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
        break;
      case 'mssql':
        selectTableQuery = `SELECT name FROM sys.tables WHERE type = 'U' ORDER BY name`;
        break;
      case 'oracledb':
        selectTableQuery = 'SELECT table_name FROM user_tables ORDER BY table_name';
        break;
      case 'snowflake':
        selectTableQuery = `SHOW TABLES`;
        break;
      case 'cockroachdb':
        selectTableQuery = `SHOW TABLES`;
        break;
      default:
        // 기본값으로 SHOW TABLES 대신 해당 엔진에 맞는 쿼리 사용
        if (databaseInfo.engine === 'sqlite') {
          selectTableQuery = `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
        } else {
          selectTableQuery = 'SHOW TABLES';
        }
        break;
    }

    console.log('Selected query:', selectTableQuery);

    // 시스템 쿼리를 위한 특별한 처리
    const tablesInfo = await this.connectionService.executeQuery({
      id: +id,
      query: selectTableQuery,
    });
    const tables = [];
    if (tablesInfo && tablesInfo.datas.length > 0) {
      tablesInfo.datas.map(tableObj => {
        tables.push({
          name: Object.values(tableObj)[0],
          comment: '',
          databaseId: id,
          datasetType: DatasetType.TABLE,
        });
      });
    } else if (tablesInfo && tablesInfo.status === ResponseStatus.ERROR) {
      return tablesInfo;
    }

    // dataset 정보 조회 - 이미 필터링된 데이터를 한 번에 조회하므로 N+1 문제 없음
    const tempDatasets = await this.datasetRepository.find({ where: { databaseId: id } });
    const datasets = tempDatasets.map(item => ({
      ...item,
      datasetType: DatasetType.DATASET,
    }));

    delete databaseInfo.connectionConfig['password'];

    return { status: ResponseStatus.SUCCESS, data: { databaseInfo, tables, datasets } };
  }

  /**
   * database 정보 단순 조회
   * @param id
   */
  async findSimple(id: number): Promise<any> {
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    databaseInfo.connectionConfig = JSON.parse(databaseInfo.connectionConfig).connection;
    delete databaseInfo.connectionConfig['password'];
    return { status: ResponseStatus.SUCCESS, data: { databaseInfo } };
  }

  /**
   * 데이터베이스 테이블 목록 조회 (안전한 방법)
   * @param id
   */
  async findTables(id: number): Promise<any> {
    try {
      const databaseInfo = await this.findDB(id);
      if (!databaseInfo) {
        return { status: ResponseStatus.ERROR, message: 'Database not found' };
      }

      // 데이터베이스 엔진별로 테이블 목록을 안전하게 가져오는 방법
      // 여기서는 미리 정의된 안전한 테이블 목록이나 메타데이터를 반환
      const tables = [];

      // TODO: 실제 구현에서는 각 데이터베이스 타입별로 안전한 방법으로 테이블 목록을 가져와야 함
      // 예: 별도의 메타데이터 테이블이나 캐시된 정보 사용

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          tables: tables,
          message: 'Table list retrieval is currently limited due to security restrictions',
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: error.message || 'Failed to fetch tables',
      };
    }
  }

  /**
   * db config 정보 단순 조회
   * @param id
   */
  private async findDB(id: number) {
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    databaseInfo.connectionConfig = JSON.parse(databaseInfo.connectionConfig);
    return databaseInfo;
  }

  /**
   * database(데이터소스) 정보 수정
   * @param id
   * @param updateDatabaseDto
   */
  async update(id: number, updateDatabaseDto: UpdateDatabaseDto) {
    const one = await this.databaseRepository.findOne({ where: { id } });
    one.name = updateDatabaseDto.name;
    one.engine = updateDatabaseDto.engine;

    // SQLite 특별 처리
    if (updateDatabaseDto.engine === 'sqlite' || updateDatabaseDto.engine === 'better-sqlite3') {
      const config = typeof updateDatabaseDto.connectionConfig === 'string' 
        ? JSON.parse(updateDatabaseDto.connectionConfig)
        : updateDatabaseDto.connectionConfig;
      
      updateDatabaseDto.connectionConfig = JSON.stringify({
        database: config.database || './demo.db',
      });
    }

    one.connectionConfig =
      typeof updateDatabaseDto.connectionConfig === 'string'
        ? updateDatabaseDto.connectionConfig
        : JSON.stringify({
            client: one.engine,
            connection: updateDatabaseDto.connectionConfig,
            useNullAsDefault: true,
          });

    if (updateDatabaseDto.engine === 'cockroachdb') {
      const connectioninfo = updateDatabaseDto.connectionConfig;
      const cockroach_url = `postgresql://${connectioninfo['user']}:${connectioninfo['password']}@${connectioninfo['host']}:${connectioninfo['port']}/${connectioninfo['database']}?sslmode=verify-full&options=--cluster%3Dvanillameta-cockroach-3010`;
      connectioninfo['connectionString'] = cockroach_url;
    }

    // connectionConfig 파싱
    let parsedConnectionConfig: any = updateDatabaseDto.connectionConfig;
    if (typeof parsedConnectionConfig === 'string') {
      try {
        parsedConnectionConfig = JSON.parse(parsedConnectionConfig);
      } catch (e) {
        parsedConnectionConfig = {};
      }
    }

    // SQLite 특별 처리
    let connectionConfig;
    if (one.engine === 'sqlite' || one.engine === 'better-sqlite3') {
      connectionConfig = {
        client: one.engine,
        connection: {
          filename: parsedConnectionConfig.database || './demo.db',
        },
        useNullAsDefault: true,
      };
    } else {
      connectionConfig = {
        client: one.engine,
        connection: parsedConnectionConfig,
        useNullAsDefault: true,
      };
    }
    updateDatabaseDto.connectionConfig = JSON.stringify(connectionConfig);

    // const connectionConfig = {
    //   client: one.engine,
    //   connection: Object(one.connectionConfig).connection,
    //   useNullAsDefault: true,
    // };
    // updateDatabaseDto.connectionConfig = JSON.stringify(connectionConfig);

    // TODO: validation pipe
    one.updatedAt = new Date();
    return this.databaseRepository.save(one);
  }

  /**
   * database(데이터소스) 연결 삭제
   * @param id
   */
  async remove(id: number) {
    await this.databaseRepository.delete({ id });
    await this.connectionService.removeKnex(id);
    return 'success';
  }

  /**
   * database(데이터소스) 연결 테스트
   * @param createDatabaseDto
   */
  testDatabase(createDatabaseDto: CreateDatabaseDto) {
    return this.connectionService.testConnection(createDatabaseDto);
  }

  /**
   * database(데이터소스) 쿼리 실행
   * @param queryExecuteDto
   */
  executeQuery(queryExecuteDto: QueryExecuteDto) {
    return this.connectionService.executeQuery(queryExecuteDto);
  }

  /**
   * 데이터베이스 타입 목록 조회
   */
  async findTypeList() {
    return this.findAllDbTypes();
  }

  /**
   * 데이터 조회
   */
  async findData(datasetType: DatasetType, databaseId: number, datasetId?: number, tableName?: string) {
    // 데이터셋 타입에 따라 다른 로직 실행
    if (datasetType === DatasetType.TABLE) {
      // 테이블 데이터 조회
      return this.findTables(databaseId);
    }
    
    // 기타 데이터셋 타입 처리
    return [];
  }

  /**
   * 데이터베이스 연결정보 조회
   */
  async findOneInfo(id: number) {
    return this.findSimple(id);
  }
}