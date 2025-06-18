import { Injectable } from '@nestjs/common';
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

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    @InjectRepository(DatabaseType) private databaseTypeRepository: Repository<DatabaseType>,
    @InjectRepository(Dataset) private datasetRepository: Repository<Dataset>,
    @InjectRepository(TableQuery) private tableQueryRepository: Repository<TableQuery>,
    private readonly connectionService: ConnectionService,
  ) {}

  /**
   * database type 목록 조회
   */
  async findTypeList() {
    const result = await this.databaseTypeRepository.find({ where: { useYn: YesNo.YES } });
    return { status: ResponseStatus.SUCCESS, data: result };
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

    const saveResult = await this.databaseRepository.save(databaseDto);
    saveResult.connectionConfig = JSON.parse(saveResult.connectionConfig);
    return { status: ResponseStatus.SUCCESS, data: saveResult };
  }

  /**
   * database 목록 조회
   */
  async findAll() {
    const result = await this.databaseRepository.find();
    result.forEach(db => {
      db.connectionConfig = JSON.parse(db.connectionConfig);
      delete db.connectionConfig['password'];
      const configElement = db.connectionConfig['connection'];
      if (configElement) delete configElement['password'];
    });
    return { status: ResponseStatus.SUCCESS, data: result };
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
          id: Object.values(tableObj)[0],
          tableName: Object.values(tableObj)[0],
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
  async findOneInfo(id: number): Promise<any> {
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

  async update(id: number, updateDatabaseDto: UpdateDatabaseDto) {
    const one = await this.findDB(id);
    if (!one)
      return {
        status: ResponseStatus.ERROR,
        message: `조건에 맞는 데이터베이스를 찾지 못했습니다. id:${id}`,
      };

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

    const saveResult = await this.databaseRepository.update(
      { id },
      { name: updateDatabaseDto.name, connectionConfig: updateDatabaseDto.connectionConfig },
    );

    if (saveResult.affected === 1) {
      return { status: ResponseStatus.SUCCESS, data: { message: `${id} 수정 완료` } };
    } else {
      return { status: ResponseStatus.ERROR, message: '수정 실패' };
    }
  }

  async remove(id: number) {
    const one = await this.findDB(id);
    if (!one)
      return {
        status: ResponseStatus.ERROR,
        message: `조건에 맞는 데이터베이스를 찾지 못했습니다. id:${id}`,
      };

    // 연관된 widget 제거
    const deletedWidget = await this.datasetRepository.query(
      `delete from widget
where ((datasetType = 'DATASET' and datasetId in (select id from dataset where databaseId = ?)) or
       (datasetType = 'TABLE' and datasetId in (select id from table_query where databaseId = ?)))`,
      [id, id],
    );
    // table query 삭제
    await this.tableQueryRepository.delete({ databaseId: id });
    // dataset 삭제
    const deletedDataset = await this.datasetRepository.delete({ databaseId: id });
    // database 삭제
    await this.databaseRepository.remove(one);

    return {
      status: ResponseStatus.SUCCESS,
      data: {
        message: `${deletedWidget.affected}개의 widget, ${deletedDataset.affected}개의 dataset, databse [${one.name}] 삭제 완료`,
      },
    };
  }

  /**
   * 데이터 조회
   * @param datasetType
   * @param databaseId
   * @param datasetId
   * @param tableName
   */
  async findData(
    datasetType: DatasetType,
    databaseId: number,
    datasetId?: number,
    tableName?: string,
  ) {
    if (datasetType === DatasetType.DATASET && datasetId === undefined) {
      return {
        status: ResponseStatus.ERROR,
        message: 'DATASET의 경우,  datasetId가 필수 입력 사항입니다.',
      };
    } else if (
      datasetType === DatasetType.TABLE &&
      tableName === undefined &&
      datasetId === undefined
    ) {
      return {
        status: ResponseStatus.ERROR,
        message: 'TABLE의 경우, tableName이나 datasetId 둘 중 하나는 입력해야합니다.',
      };
    }

    const queryExecuteDto = new QueryExecuteDto();
    if (datasetType === DatasetType.DATASET) {
      const datasetItem = await this.datasetRepository.findOne({ where: { id: datasetId } });
      queryExecuteDto.id = datasetItem.databaseId;
      queryExecuteDto.query = datasetItem.query;
    } else if (datasetType === DatasetType.TABLE) {
      if (datasetId != undefined) {
        const datasetItem = await this.tableQueryRepository.findOne({ where: { id: datasetId } });
        queryExecuteDto.id = datasetItem.databaseId;
        queryExecuteDto.query = datasetItem.query;
      } else {
        const databaseOne = await this.databaseRepository.findOne({ where: { id: databaseId } });
        let selectQuery;
        switch (databaseOne.type) {
          case 'bigquery':
            const schemaName = JSON.parse(databaseOne.connectionConfig).connection.schema;
            selectQuery = `SELECT * FROM ${schemaName}.${tableName}`;
            break;
          case 'oracle':
            selectQuery = `SELECT * FROM "${tableName}"`;
            break;
          default:
            selectQuery = `SELECT * FROM ${tableName}`;
            break;
        }
        queryExecuteDto.id = databaseId;
        queryExecuteDto.query = selectQuery;
      }
    }
    const queryResult = await this.connectionService.executeQuery(queryExecuteDto);
    if (queryResult.status === 'ERROR') return queryResult;
    else
      return {
        status: queryResult.status,
        data: { datas: queryResult.datas, fields: queryResult.fields },
      };
  }
}
