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
import { knex } from 'knex';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_TABLE = 'uploaded_data';
const UPLOAD_MAX_ROWS = 100000;

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectRepository(Database) private databaseRepository: Repository<Database>,
    @InjectRepository(DatabaseType) private databaseTypeRepository: Repository<DatabaseType>,
    @InjectRepository(Dataset) private datasetRepository: Repository<Dataset>,
    @InjectRepository(TableQuery) private tableQueryRepository: Repository<TableQuery>,
    private readonly connectionService: ConnectionService,
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

  /**
   * 업로드된 CSV/JSON 파일을 SQLite 기반 데이터소스로 저장한다.
   * 파일은 FILE_UPLOAD_DIR(기본 <cwd>/uploads) 아래 <uuid>.db 로 기록되고,
   * uploaded_data 테이블을 가진 sqlite database 레코드가 생성된다.
   */
  async uploadFile(file: { originalname: string; buffer: Buffer }) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.csv', '.json', '.parquet'].includes(ext)) {
      throw new BadRequestException('unsupported file extension');
    }
    const rows =
      ext === '.json'
        ? this.parseJsonRows(file.buffer)
        : ext === '.parquet'
        ? await this.parseParquetRows(file.buffer)
        : this.parseCsvRows(file.buffer);
    if (!rows.length) {
      throw new BadRequestException('no rows found in the uploaded file');
    }
    if (rows.length > UPLOAD_MAX_ROWS) {
      throw new BadRequestException(`row limit exceeded (max ${UPLOAD_MAX_ROWS})`);
    }

    // 컬럼명 sanitize + dedupe (식별자 인젝션 및 잘못된 헤더 방지)
    const rawColumns = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const seen = new Set<string>();
    const columns = rawColumns.map((name, i) => {
      let safe = name.trim().replace(/[^A-Za-z0-9_]/g, '_');
      if (!safe) safe = `col_${i + 1}`;
      if (/^[0-9]/.test(safe)) safe = `_${safe}`;
      while (seen.has(safe)) safe = `${safe}_`;
      seen.add(safe);
      return safe;
    });
    columns.forEach(c => assertSafeIdentifier(c));

    // 최대 100행 샘플로 숫자 컬럼 추론
    const numeric = columns.map((_, i) =>
      rows.slice(0, 100).every(r => {
        const v = r[rawColumns[i]];
        return v === undefined || v === null || v === '' || !isNaN(Number(v));
      }),
    );

    const uploadDir = process.env.FILE_UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    const dbPath = path.join(uploadDir, `${randomUUID()}.db`);
    const db = knex({
      client: 'sqlite3',
      connection: { filename: dbPath },
      useNullAsDefault: true,
    });
    try {
      await db.schema.createTable(UPLOAD_TABLE, table => {
        columns.forEach((c, i) => (numeric[i] ? table.float(c) : table.text(c)));
      });
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500).map(r => {
          const obj: Record<string, unknown> = {};
          columns.forEach((c, j) => {
            const v = r[rawColumns[j]];
            obj[c] =
              v === undefined || v === null || v === ''
                ? null
                : typeof v === 'object'
                ? JSON.stringify(v)
                : v;
          });
          return obj;
        });
        await db(UPLOAD_TABLE).insert(batch);
      }
    } finally {
      await db.destroy();
    }

    const baseName = path.basename(file.originalname, ext);
    const databaseDto = new Database();
    databaseDto.name = baseName;
    databaseDto.description = `File upload: ${file.originalname}`;
    databaseDto.engine = 'sqlite3';
    databaseDto.type = 'sqlite';
    databaseDto.timezone = 'Asia/Seoul';
    databaseDto.connectionConfig = encryptConnectionConfig(
      JSON.stringify({
        client: 'sqlite3',
        connection: { filename: dbPath },
        useNullAsDefault: true,
      }),
    );
    const saveResult = await this.databaseRepository.save(databaseDto);
    return {
      status: ResponseStatus.SUCCESS,
      data: { id: saveResult.id, name: baseName, tableName: UPLOAD_TABLE, rows: rows.length },
    };
  }

  /**
   * CSV 텍스트 → 객체 배열 (따옴표/이스케이프/CRLF 처리)
   */
  private parseCsvRows(buffer: Buffer): Record<string, unknown>[] {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const grid: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"' && field === '') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        if (row.length > 1 || row[0] !== '') grid.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      grid.push(row);
    }
    if (grid.length < 2) return [];
    const seen = new Set<string>();
    const header = grid[0].map((name, i) => {
      let unique = name || `col_${i + 1}`;
      while (seen.has(unique)) unique += '_';
      seen.add(unique);
      return unique;
    });
    return grid
      .slice(1)
      .filter(r => r.some(v => v !== ''))
      .map(r => {
        const obj: Record<string, unknown> = {};
        header.forEach((h, i) => (obj[h] = r[i] ?? null));
        return obj;
      });
  }

  /**
   * Parquet 버퍼 → 객체 배열 (parquetjs-lite, 서버에서 직접 디코딩)
   */
  private async parseParquetRows(buffer: Buffer): Promise<Record<string, unknown>[]> {
    const { ParquetReader } = await import('parquetjs-lite');
    let reader;
    try {
      reader = await ParquetReader.openBuffer(buffer);
    } catch {
      throw new BadRequestException('invalid parquet file');
    }
    const rows: Record<string, unknown>[] = [];
    const cursor = reader.getCursor();
    try {
      let record = await cursor.next();
      while (record && rows.length <= UPLOAD_MAX_ROWS) {
        rows.push(record);
        record = await cursor.next();
      }
    } finally {
      await reader.close();
    }
    return rows;
  }

  /**
   * JSON 배열 → 객체 배열 (flat object만 허용)
   */
  private parseJsonRows(buffer: Buffer): Record<string, unknown>[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(buffer.toString('utf8'));
    } catch {
      throw new BadRequestException('invalid json file');
    }
    if (
      !Array.isArray(parsed) ||
      !parsed.every(item => item && typeof item === 'object' && !Array.isArray(item))
    ) {
      throw new BadRequestException('json file must contain an array of objects');
    }
    return parsed as Record<string, unknown>[];
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
            selectQuery = `SELECT * FROM ${tableName}`;
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
