import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { Repository } from 'typeorm';
import { ConnectionService } from '../connection/connection.service';
import { Dataset } from '../dataset/entities/dataset.entity';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { DatasetType } from '../common/enum/dataset-type.enum';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { QueryExecuteDto } from './dto/query-execute.dto';
import { DatabaseType } from './entities/database_type.entity';
import { YesNo } from '../common/enum/yn.enum';
import { decryptConnectionConfig, encryptConnectionConfig } from '../utils/crypto.util';
import { assertSafeIdentifier } from '../utils/query-guard.util';
import * as path from 'path';
import { AnalysisUpload, DuckDBService } from '../analysis/duckdb.service';

const UPLOAD_TABLE = 'uploaded_data';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    @InjectRepository(DatabaseType) private databaseTypeRepository: Repository<DatabaseType>,
    @InjectRepository(Dataset) private datasetRepository: Repository<Dataset>,
    @InjectRepository(TableQuery) private tableQueryRepository: Repository<TableQuery>,
    private readonly connectionService: ConnectionService,
    private readonly duckdbService?: DuckDBService,
  ) {}

  private validateId(id: unknown): number {
    const normalized =
      typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : NaN;
    if (!Number.isSafeInteger(normalized) || normalized <= 0) {
      throw new BadRequestException('invalid database id');
    }
    return normalized;
  }

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
    const connectionConfig = {
      client: databaseDto.engine,
      connection: databaseDto.connectionConfig,
      useNullAsDefault: true,
    };
    if (connectionConfig.client === 'cockroachdb') {
      const connectioninfo = connectionConfig.connection;
      const cockroach_url = `postgresql://${connectioninfo['user']}:${connectioninfo['password']}@${connectioninfo['host']}:${connectioninfo['port']}/${connectioninfo['database']}?sslmode=verify-full&options=--cluster%3Dvanillameta-cockroach-3010`;
      connectioninfo['connectionString'] = cockroach_url;
    }

    databaseDto.connectionConfig = encryptConnectionConfig(JSON.stringify(connectionConfig));
    databaseDto.timezone = 'Asia/Seoul';

    const saveResult = await this.databaseRepository.save(databaseDto);
    saveResult.connectionConfig = JSON.parse(decryptConnectionConfig(saveResult.connectionConfig));
    return { status: ResponseStatus.SUCCESS, data: saveResult };
  }

  /** Preserve raw files and import analytical data in the worker, leaving metadata in TypeORM. */
  async uploadFile(file: AnalysisUpload) {
    const imported = await this.duckdbService.importFile(file);
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const database = new Database();
    database.name = baseName;
    database.description = `File upload: ${file.originalname}`;
    database.engine = 'duckdb';
    database.type = 'duckdb';
    database.timezone = 'Asia/Seoul';
    database.connectionConfig = encryptConnectionConfig(
      JSON.stringify({
        client: 'duckdb',
        connection: { filename: imported.filename },
      }),
    );
    let saved: Database;
    try {
      saved = await this.databaseRepository.save(database);
    } catch (error) {
      await this.duckdbService.removeImport(imported.filename);
      throw error;
    }
    // Metadata is authoritative. An auxiliary manifest failure must not delete a registered source.
    try {
      await this.duckdbService.registerImport(imported.filename, saved.id);
    } catch {
      this.logger.warn(`analysis manifest registration failed for database ${saved.id}`);
    }
    return {
      status: ResponseStatus.SUCCESS,
      data: { id: saved.id, name: baseName, tableName: UPLOAD_TABLE, rows: imported.rows },
    };
  }

  /**
   * database 목록 조회
   */
  async findAll() {
    const result = await this.databaseRepository.find();
    const alive: Database[] = [];
    result.forEach(db => {
      try {
        db.connectionConfig = JSON.parse(decryptConnectionConfig(db.connectionConfig));
      } catch (e) {
        this.logger.error(
          `database ${db.id} (${db.name}): connection config decrypt failed`,
          e instanceof Error ? e.message : e,
        );
        (db as any).connectionConfig = {};
        (db as any).configError = true;
        alive.push(db);
        return;
      }
      delete db.connectionConfig['password'];
      const configElement = db.connectionConfig['connection'];
      if (configElement) delete configElement['password'];
      alive.push(db);
    });
    return { status: ResponseStatus.SUCCESS, data: alive };
  }

  /**
   * database 정보 조회
   * @param id
   */
  async findOne(id: number): Promise<any> {
    id = this.validateId(id);
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    if (!databaseInfo) throw new NotFoundException('database not found');
    let connection: any;
    try {
      connection = JSON.parse(decryptConnectionConfig(databaseInfo.connectionConfig)).connection;
    } catch {
      throw new BadRequestException(
        '데이터 소스 접속 정보를 복호화할 수 없습니다 (키가 변경됐거나 데이터가 손상됐습니다)',
      );
    }
    databaseInfo.connectionConfig = connection;

    // table 정보 조회
    let selectTableQuery;
    switch (databaseInfo.engine) {
      case 'mysql2':
        selectTableQuery = 'show tables';
        break;
      case 'pg':
        selectTableQuery = `SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' and table_schema not in ('information_schema', 'pg_catalog', 'pg_internal')`;
        break;
      case 'duckdb':
        selectTableQuery = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_type = 'BASE TABLE'`;
        break;
      case 'sqlite3':
        selectTableQuery = `SELECT tbl_name FROM sqlite_master WHERE type = 'table'`;
        break;
      case 'mssql':
        selectTableQuery = 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES';
        break;
      case 'bigquery':
        selectTableQuery = `select table_id from ${databaseInfo.connectionConfig['schema']}.__TABLES__`;
        break;
      case 'oracledb':
        selectTableQuery = 'SELECT table_name FROM user_tables ORDER BY table_name';
        break;
      case 'snowflake':
        selectTableQuery = `select table_name from information_schema.tables where table_type = 'BASE TABLE'`;
        break;
      case 'cockroachdb':
        selectTableQuery = `SELECT TABLE_NAME FROM information_schema.tables WHERE table_type = 'BASE TABLE'`;
        break;
      case 'clickhouse':
        selectTableQuery = 'SHOW TABLES';
        break;
      case 'trino':
        selectTableQuery = 'SHOW TABLES';
        break;
      case 'databricks':
        selectTableQuery = 'SHOW TABLES';
        break;
      default:
        selectTableQuery = 'show tables';
        break;
    }

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

    // dataset 정보 조회
    const tempDatasets = await this.datasetRepository.find({ where: { databaseId: id } });
    const datasets = [];
    tempDatasets.map(item => {
      datasets.push(Object.assign({ datasetType: DatasetType.DATASET }, item));
    });

    delete databaseInfo.connectionConfig['password'];

    return { status: ResponseStatus.SUCCESS, data: { databaseInfo, tables, datasets } };
  }

  /**
   * database 정보 단순 조회
   * @param id
   */
  async findOneInfo(id: number): Promise<any> {
    id = this.validateId(id);
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    if (!databaseInfo) throw new NotFoundException('database not found');
    let connection: any;
    try {
      connection = JSON.parse(decryptConnectionConfig(databaseInfo.connectionConfig)).connection;
    } catch {
      throw new BadRequestException(
        '데이터 소스 접속 정보를 복호화할 수 없습니다 (키가 변경됐거나 데이터가 손상됐습니다)',
      );
    }
    databaseInfo.connectionConfig = connection;
    delete databaseInfo.connectionConfig['password'];
    return { status: ResponseStatus.SUCCESS, data: { databaseInfo } };
  }

  /**
   * db config 정보 단순 조회
   * @param id
   */
  private async findDB(id: number) {
    id = this.validateId(id);
    // 연동 db 정보
    const databaseInfo = await this.databaseRepository.findOne({ where: { id } });
    if (!databaseInfo) return null;
    databaseInfo.connectionConfig = JSON.parse(
      decryptConnectionConfig(databaseInfo.connectionConfig),
    );
    return databaseInfo;
  }

  async update(id: number, updateDatabaseDto: UpdateDatabaseDto) {
    id = this.validateId(id);
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

    const connectionConfig = {
      client: one.engine,
      connection: updateDatabaseDto.connectionConfig,
      useNullAsDefault: true,
    };
    updateDatabaseDto.connectionConfig = encryptConnectionConfig(JSON.stringify(connectionConfig));

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
      await this.connectionService.removeKnex(id);
      return { status: ResponseStatus.SUCCESS, data: { message: `${id} 수정 완료` } };
    } else {
      return { status: ResponseStatus.ERROR, message: '수정 실패' };
    }
  }

  async remove(id: number) {
    id = this.validateId(id);
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
    await this.connectionService.removeKnex(id);
    if (one.engine === 'duckdb') {
      await this.duckdbService.removeImport(one.connectionConfig['connection'].filename);
    }

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
    clientId?: string,
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
        assertSafeIdentifier(tableName);
        const databaseOne = await this.databaseRepository.findOne({ where: { id: databaseId } });
        let selectQuery;
        switch (databaseOne.type) {
          case 'bigquery':
            const schemaName = JSON.parse(decryptConnectionConfig(databaseOne.connectionConfig))
              .connection.schema;
            selectQuery = `SELECT * FROM ${schemaName}.${tableName}`;
            break;
          case 'oracle':
            selectQuery = `SELECT * FROM "${tableName}"`;
            break;
          default:
            selectQuery = `SELECT * FROM ${tableName}${
              databaseOne.engine === 'duckdb' ? ' LIMIT 500' : ''
            }`;
            break;
        }
        queryExecuteDto.id = databaseId;
        queryExecuteDto.query = selectQuery;
      }
    }
    const queryResult = await this.connectionService.executeQuery(queryExecuteDto, clientId);
    if (queryResult.status === 'ERROR') return queryResult;
    else
      return {
        status: queryResult.status,
        data: { datas: queryResult.datas, fields: queryResult.fields },
      };
  }
}
