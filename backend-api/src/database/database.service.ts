import { lockSourceActor, assertSourceOwner, sourceWriteFields } from './source-write-lock';
import { lockMetricSources } from '../metric/metric-write-lock';
import { serializeMetadataWork, metadataTransaction } from '../common/metadata-work';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateDatabaseDto } from './dto/create-database.dto';
import { UpdateDatabaseDto } from './dto/update-database.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Database } from './entities/database.entity';
import { EntityManager, Repository } from 'typeorm';
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
import * as fs from 'fs/promises';
import { createHash } from 'crypto';
import { AnalysisUpload, DuckDBService } from '../analysis/duckdb.service';
import { diffFileSchema } from './file-schema-diff';
import { FileCorrection } from '../analysis/file-correction';

const UPLOAD_TABLE = 'uploaded_data';
/** Internal hook: a durable receipt can commit atomically with the source pointer. */
export type FileReplacementCommit = (
  activate: (manager: EntityManager) => Promise<any>,
) => Promise<any>;

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

  /** Public metadata must not expose credentials or URLs containing credentials. */
  private publicConnectionConfig(value: any): any {
    if (Array.isArray(value)) return value.map(item => this.publicConnectionConfig(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) => !['password', 'connectionstring', 'fileversions'].includes(key.toLowerCase()),
        )
        .map(([key, item]) => [key, this.publicConnectionConfig(item)]),
    );
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
  async create(createDatabaseDto: CreateDatabaseDto, ownerId?: number, expectedEpoch?: number) {
    createDatabaseDto = this.writeInput(createDatabaseDto);
    this.webConfig(createDatabaseDto.engine, createDatabaseDto.connectionConfig);
    return metadataTransaction(this.databaseRepository.manager, async manager => {
      await lockSourceActor(manager, ownerId, expectedEpoch);
      const databaseDto = Database.toDto(createDatabaseDto);
      databaseDto.ownerId = ownerId;
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

      const saveResult = await manager.save(Database, databaseDto);
      saveResult.connectionConfig = this.publicConnectionConfig(
        JSON.parse(decryptConnectionConfig(saveResult.connectionConfig)),
      );
      return { status: ResponseStatus.SUCCESS, data: saveResult };
    });
  }

  /** Preserve raw files and import analytical data in the worker, leaving metadata in TypeORM. */
  async uploadFile(file: AnalysisUpload, ownerId?: number, expectedEpoch?: number) {
    const imported = await this.duckdbService.importFile(file);
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    const database = new Database();
    database.ownerId = ownerId;
    database.name = baseName;
    database.description = `File upload: ${file.originalname}`;
    database.engine = 'duckdb';
    database.type = 'duckdb';
    database.timezone = 'Asia/Seoul';
    let saved: Database;
    try {
      database.connectionConfig = encryptConnectionConfig(
        JSON.stringify({
          client: 'duckdb',
          connection: { filename: imported.filename },
          fileVersions: [
            {
              id: path.basename(path.dirname(imported.filename)),
              filename: imported.filename,
              originalname: file.originalname,
              rows: imported.rows,
              uploadedAt: new Date().toISOString(),
              sha256: await this.duckdbService.sourceDigest(imported.filename),
            },
          ],
        }),
      );
      saved = await metadataTransaction(this.databaseRepository.manager, async manager => {
        await lockSourceActor(manager, ownerId, expectedEpoch);
        return manager.save(Database, database);
      });
    } catch (error) {
      await this.duckdbService
        .discardImport(imported.filename)
        .catch(() => this.logger.warn('unregistered analysis import cleanup failed'));
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

  private async fileState(id: number, ownerId: number) {
    id = this.validateId(id);
    const row = await serializeMetadataWork(this.databaseRepository.manager.connection, () =>
      this.databaseRepository.findOne({ where: { id } }),
    );
    if (!row) throw new NotFoundException('데이터 소스를 찾을 수 없습니다.');
    if (row.ownerId !== ownerId || !Number.isSafeInteger(ownerId) || ownerId <= 0)
      throw new ForbiddenException('다른 사용자의 파일은 변경할 수 없습니다.');
    if (row.catalogActive === false) throw new ForbiddenException('Source unavailable.');
    if (row.engine !== 'duckdb')
      throw new BadRequestException('서버에 저장한 파일만 교체할 수 있습니다.');
    const config = JSON.parse(decryptConnectionConfig(row.connectionConfig));
    const filename = config.connection?.filename;
    // A commerce bundle has several tables and a separate publishing contract.
    await this.duckdbService.query(filename, 'DESCRIBE uploaded_data');
    const versions = config.fileVersions || [
      {
        id: path.basename(path.dirname(filename)),
        filename,
        originalname: row.description?.startsWith('File upload: ')
          ? row.description.slice(13)
          : row.name,
        rows: Number(
          (await this.duckdbService.query(filename, 'SELECT COUNT(*) AS n FROM uploaded_data'))
            .datas[0].n,
        ),
        uploadedAt: row.createdAt?.toISOString?.() || row.createdAt || new Date().toISOString(),
        sha256: await this.duckdbService.sourceDigest(filename),
      },
    ];
    return {
      row,
      config,
      versions,
      revision: createHash('sha256').update(row.connectionConfig).digest('hex'),
    };
  }

  private publicVersions(state: any) {
    return {
      status: ResponseStatus.SUCCESS,
      data: {
        sourceId: state.row.id,
        supportsCorrection: !state.config.fileModel,
        ...(state.config.fileModel ? { supportsRefresh: false } : {}),
        revision: state.revision,
        limit: 5,
        currentVersionId: path.basename(path.dirname(state.config.connection.filename)),
        versions: state.versions.map(v => ({
          id: v.id,
          originalname: v.originalname,
          rows: v.rows,
          uploadedAt: v.uploadedAt,
          current: v.filename === state.config.connection.filename,
        })),
      },
    };
  }

  async fileVersions(id: number, ownerId: number) {
    return this.publicVersions(await this.fileState(id, ownerId));
  }

  private expectFileRevision(state: any, expected: unknown) {
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected))
      throw new BadRequestException('파일 버전을 다시 불러와 주세요.');
    if (state.revision !== expected)
      throw new ConflictException(
        '다른 화면에서 파일이 변경되었습니다. 최신 버전을 다시 불러와 주세요.',
      );
  }

  private async switchFile(
    state: any,
    version: any,
    versions: any[],
    actor: number,
    epoch: number,
    commit?: FileReplacementCommit,
  ) {
    const activate = async (manager: EntityManager) => {
      await lockSourceActor(manager, actor, epoch);
      const sources = await lockMetricSources(manager, [state.row.id]);
      assertSourceOwner(sources.get(state.row.id), actor);
      const config = {
        ...state.config,
        connection: { ...state.config.connection, filename: version.filename },
        fileVersions: versions,
      };
      const connectionConfig = encryptConnectionConfig(JSON.stringify(config));
      const updated = await manager.getRepository(Database).update(
        {
          id: state.row.id,
          ownerId: state.row.ownerId,
          connectionConfig: state.row.connectionConfig,
        },
        { connectionConfig },
      );
      if (updated.affected !== 1)
        throw new ConflictException(
          '파일이 동시에 변경되었습니다. 최신 버전을 다시 불러와 주세요.',
        );
      // Return the state this request committed; a later request may already have switched again.
      return this.publicVersions({
        ...state,
        config,
        versions,
        revision: createHash('sha256').update(connectionConfig).digest('hex'),
      });
    };
    return commit
      ? commit(activate)
      : metadataTransaction(this.databaseRepository.manager, activate);
  }

  private async confirmFileUnchanged(
    state: any,
    expected: unknown,
    actor: number,
    epoch: number,
    commit?: FileReplacementCommit,
    correctionStats?: any,
  ) {
    const latest = await this.fileState(state.row.id, state.row.ownerId);
    this.expectFileRevision(latest, expected);
    const result = () => {
      const value = this.publicVersions(latest);
      return {
        ...value,
        data: { ...value.data, ...(correctionStats ? { correctionStats } : {}) },
        unchanged: true,
      };
    };
    const activate = async (manager: EntityManager) => {
      await lockSourceActor(manager, actor, epoch);
      const sources = await lockMetricSources(manager, [state.row.id]);
      assertSourceOwner(sources.get(state.row.id), actor);
      const current = await manager.findOne(Database, {
        where: {
          id: state.row.id,
          ownerId: state.row.ownerId,
          connectionConfig: latest.row.connectionConfig,
        },
        ...(manager.connection.options.type !== 'sqlite'
          ? { lock: { mode: 'pessimistic_write' as const } }
          : {}),
      });
      if (!current)
        throw new ConflictException(
          '파일이 동시에 변경되었습니다. 최신 버전을 다시 불러와 주세요.',
        );
      return result();
    };
    return commit
      ? commit(activate)
      : metadataTransaction(this.databaseRepository.manager, activate);
  }

  async replaceFile(
    id: number,
    file: AnalysisUpload,
    expectedRevision: unknown,
    ownerId: number,
    epochOrCommit?: number | FileReplacementCommit,
    correction?: FileCorrection,
    refreshEpoch?: number,
  ) {
    const commit = typeof epochOrCommit === 'function' ? epochOrCommit : undefined;
    const expectedEpoch = typeof epochOrCommit === 'number' ? epochOrCommit : refreshEpoch;
    let imported: Awaited<ReturnType<DuckDBService['importFile']>>;
    let committed = false;
    try {
      const state = await this.fileState(id, ownerId);
      if (state.config.fileModel)
        throw new BadRequestException(
          '연결 모델은 고정 스냅샷입니다. 원본 품질을 다시 확인해 새 연결 소스로 만들어 주세요.',
        );
      this.expectFileRevision(state, expectedRevision);
      const sha256 = await this.duckdbService.uploadDigest(file);
      const current = state.versions.find(v => v.filename === state.config.connection.filename);
      if (
        !correction &&
        current?.sha256 === sha256 &&
        path.extname(current.originalname).toLowerCase() ===
          path.extname(file.originalname).toLowerCase()
      ) {
        return this.confirmFileUnchanged(state, expectedRevision, ownerId, expectedEpoch, commit);
      }
      if (!correction && state.versions.length >= 5)
        throw new BadRequestException(
          '최대 5개 파일 버전을 보관합니다. 추가 갱신은 보존 정책 정리 후 진행해 주세요.',
        );
      imported = await this.duckdbService.importFile(file);
      const columns = async (filename: string) =>
        (await this.duckdbService.query(filename, 'DESCRIBE uploaded_data')).datas.map(c => ({
          name: c.column_name,
          type: c.column_type,
        }));
      const schemaDiff = diffFileSchema(
        await columns(state.config.connection.filename),
        await columns(imported.filename),
      );
      if (schemaDiff.changed)
        throw new BadRequestException({
          code: 'FILE_SCHEMA_CHANGED',
          message:
            '컬럼 이름 또는 타입이 기존 파일과 다릅니다. 기존 데이터는 유지됩니다. 같은 형식으로 수정하거나 새 데이터 소스로 연결해 주세요.',
          changes: {
            added: schemaDiff.added,
            removed: schemaDiff.removed,
            typeChanged: schemaDiff.typeChanged,
            truncated: schemaDiff.truncated,
          },
        });
      const correctionStats = correction
        ? await this.duckdbService.correctFile(
            imported.filename,
            state.config.connection.filename,
            correction,
          )
        : undefined;
      if (correctionStats?.unchanged)
        return this.confirmFileUnchanged(
          state,
          expectedRevision,
          ownerId,
          expectedEpoch,
          commit,
          correctionStats,
        );
      if (correctionStats) imported.rows = correctionStats.rows;
      if (state.versions.length >= 5)
        throw new BadRequestException(
          '최대 5개 파일 버전을 보관합니다. 추가 갱신은 보존 정책 정리 후 진행해 주세요.',
        );
      const version = {
        id: path.basename(path.dirname(imported.filename)),
        filename: imported.filename,
        originalname: file.originalname,
        rows: imported.rows,
        uploadedAt: new Date().toISOString(),
        ...(correction ? { correction: true } : { sha256 }),
      };
      const activate =
        correctionStats && commit
          ? async (write: (manager: EntityManager) => Promise<any>) =>
              commit(async manager => {
                const result = await write(manager);
                return { ...result, data: { ...result.data, correctionStats } };
              })
          : commit;
      const result = await this.switchFile(
        state,
        version,
        [...state.versions, version],
        ownerId,
        expectedEpoch,
        activate,
      );
      committed = true;
      try {
        await this.duckdbService.registerImport(imported.filename, id);
      } catch {
        this.logger.warn(`analysis manifest registration failed for database ${id}`);
      }
      return correctionStats ? { ...result, data: { ...result.data, correctionStats } } : result;
    } finally {
      // Only discard this request's unregistered candidate, never an active or historical file.
      if (imported && !committed) {
        // An ambiguous metadata commit must not delete an active or retained file.
        let referenced = true;
        try {
          const current = await this.databaseRepository.findOne({ where: { id } });
          const config = current
            ? JSON.parse(decryptConnectionConfig(current.connectionConfig))
            : undefined;
          referenced =
            config?.connection?.filename === imported.filename ||
            !!config?.fileVersions?.some(v => v.filename === imported.filename);
        } catch {
          this.logger.warn('analysis candidate cleanup deferred until metadata is readable');
        }
        if (!referenced)
          await this.duckdbService
            .discardImport(imported.filename)
            .catch(() => this.logger.warn('unregistered analysis candidate cleanup failed'));
      }
      if (file?.path) await fs.rm(file.path, { force: true });
    }
  }

  async restoreFile(id: number, body: any, ownerId: number, expectedEpoch?: number) {
    sourceWriteFields(body, ['expectedRevision', 'versionId']);
    const state = await this.fileState(id, ownerId);
    if (state.config.fileModel)
      throw new BadRequestException(
        '연결 모델은 파일 교체·복원 대신 새 연결 소스로 만들어 주세요.',
      );
    this.expectFileRevision(state, body?.expectedRevision);
    const version = state.versions.find(v => v.id === body?.versionId);
    if (!version) throw new BadRequestException('보관된 파일 버전을 선택해 주세요.');
    if (version.filename === state.config.connection.filename) return this.publicVersions(state);
    await this.duckdbService.query(version.filename, 'DESCRIBE uploaded_data');
    return this.switchFile(state, version, state.versions, ownerId, expectedEpoch);
  }

  /**
   * database 목록 조회
   */
  async findAll() {
    const result = await serializeMetadataWork(this.databaseRepository.manager.connection, () =>
      this.databaseRepository.find(),
    );
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
      db.connectionConfig = this.publicConnectionConfig(db.connectionConfig);
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
    const databaseInfo = await serializeMetadataWork(
      this.databaseRepository.manager.connection,
      () => this.databaseRepository.findOne({ where: { id } }),
    );
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

    databaseInfo.connectionConfig = this.publicConnectionConfig(databaseInfo.connectionConfig);

    return { status: ResponseStatus.SUCCESS, data: { databaseInfo, tables, datasets } };
  }

  /**
   * database 정보 단순 조회
   * @param id
   */
  async findOneInfo(id: number): Promise<any> {
    id = this.validateId(id);
    // 연동 db 정보
    const databaseInfo = await serializeMetadataWork(
      this.databaseRepository.manager.connection,
      () => this.databaseRepository.findOne({ where: { id } }),
    );
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
    databaseInfo.connectionConfig = this.publicConnectionConfig(databaseInfo.connectionConfig);
    return { status: ResponseStatus.SUCCESS, data: { databaseInfo } };
  }

  /**
   * db config 정보 단순 조회
   * @param id
   */
  private async findDB(id: number) {
    id = this.validateId(id);
    // 연동 db 정보
    const databaseInfo = await serializeMetadataWork(
      this.databaseRepository.manager.connection,
      () => this.databaseRepository.findOne({ where: { id } }),
    );
    if (!databaseInfo) return null;
    databaseInfo.connectionConfig = JSON.parse(
      decryptConnectionConfig(databaseInfo.connectionConfig),
    );
    return databaseInfo;
  }

  private writeInput<T extends UpdateDatabaseDto>(input: T): T {
    return sourceWriteFields(input, [
      'name',
      'description',
      'connectionConfig',
      'engine',
      'type',
      'timezone',
    ]);
  }
  private webConfig(engine: string, config: unknown) {
    if (['duckdb', 'sqlite', 'sqlite3', 'better-sqlite3'].includes(String(engine).toLowerCase()))
      throw new ForbiddenException('File sources require managed upload.');
    sourceWriteFields(config, [
      'host',
      'port',
      'user',
      'password',
      'database',
      'schema',
      'ssl',
      'name',
      'sid',
      'serviceName',
      'domain',
      'options',
      'projectId',
      'keyFilename',
      'instanceName',
      'fetchAsString',
      'requestTimeout',
      'account',
      'username',
      'application',
      'warehouse',
    ]);
    // Connection paths and nested driver configuration are server-owned.
    for (const [key, value] of Object.entries(config))
      if (
        value !== null &&
        typeof value === 'object' &&
        !(
          key === 'fetchAsString' &&
          Array.isArray(value) &&
          value.every(v => typeof v === 'string')
        )
      )
        throw new BadRequestException('연결 설정 값을 확인해 주세요.');
  }
  async update(
    id: number,
    updateDatabaseDto: UpdateDatabaseDto,
    actor?: number,
    expectedEpoch?: number,
  ) {
    const input = this.writeInput(updateDatabaseDto);
    id = this.validateId(id);
    await metadataTransaction(this.databaseRepository.manager, async manager => {
      await lockSourceActor(manager, actor, expectedEpoch);
      const source = (await lockMetricSources(manager, [id])).get(id);
      assertSourceOwner(source, actor);
      const patch: Partial<Database> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.connectionConfig !== undefined) {
        this.webConfig(source.engine, input.connectionConfig);
        const connection = { ...(input.connectionConfig as any) };
        if (source.engine === 'cockroachdb')
          connection.connectionString = `postgresql://${connection.user}:${connection.password}@${connection.host}:${connection.port}/${connection.database}?sslmode=verify-full&options=--cluster%3Dvanillameta-cockroach-3010`;
        patch.connectionConfig = encryptConnectionConfig(
          JSON.stringify({ client: source.engine, connection, useNullAsDefault: true }),
        );
      }
      if (Object.keys(patch).length) await manager.update(Database, id, patch);
    });
    await this.connectionService.removeKnex(id);
    return { status: ResponseStatus.SUCCESS, data: { message: `${id} 수정 완료` } };
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
        const databaseOne = await serializeMetadataWork(
          this.databaseRepository.manager.connection,
          () => this.databaseRepository.findOne({ where: { id: databaseId } }),
        );
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
