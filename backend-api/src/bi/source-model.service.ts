import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import * as path from 'path';
import { DuckDBService } from '../analysis/duckdb.service';
import { fileLookupDefinition } from '../analysis/file-lookup';
import { Database } from '../database/entities/database.entity';
import { UserStorageService } from '../database/user-storage.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { decryptConnectionConfig, encryptConnectionConfig } from '../utils/crypto.util';
import { serializedViewWrite } from '../dashboard/view-write-queue';
import { BiService } from './bi.service';
import { sourceRevision } from './source-revision';
import { SourceModelReceipt } from './source-model-receipt.entity';

const digest = (value: any) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const HEX = /^[a-f0-9]{64}$/;
@Injectable()
export class SourceModelService {
  constructor(
    private readonly db: DataSource,
    private readonly bi: BiService,
    private readonly access: SourceAccessService,
    private readonly worker: DuckDBService,
    private readonly storage?: UserStorageService,
  ) {}
  private spec(value: any) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !==
        'definition,factRevision,factSourceId,lookupRevision,lookupSourceId' ||
      !HEX.test(value.factRevision) ||
      !HEX.test(value.lookupRevision)
    )
      throw new BadRequestException('연결 기준 데이터 버전을 확인해 주세요.');
    const factSourceId = this.access.id(value.factSourceId),
      lookupSourceId = this.access.id(value.lookupSourceId);
    if (factSourceId === lookupSourceId)
      throw new BadRequestException('서로 다른 두 소스를 선택해 주세요.');
    try {
      return {
        factSourceId,
        lookupSourceId,
        factRevision: value.factRevision,
        lookupRevision: value.lookupRevision,
        definition: fileLookupDefinition(value.definition),
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  private async current(
    manager: EntityManager,
    id: number,
    actor: number,
    revision: string,
    lock = false,
  ) {
    const source = await manager.findOne(Database, {
      where: { id, ownerId: actor, engine: 'duckdb' },
      ...(lock && this.db.options.type !== 'sqlite'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (!source) throw new NotFoundException('연결할 내 파일 소스를 사용할 수 없습니다.');
    const config = JSON.parse(decryptConnectionConfig(source.connectionConfig));
    if (
      typeof config.connection?.filename !== 'string' ||
      sourceRevision(
        source,
        createHash('sha256').update(config.connection.filename).digest('hex'),
      ) !== revision
    )
      throw new ConflictException('원본 파일이 바뀌었습니다. 품질 미리보기를 다시 확인해 주세요.');
    return { source, config };
  }
  private async prepare(input: any, actor: number) {
    const spec = this.spec(input);
    const fact = await this.bi.profile(spec.factSourceId, actor);
    const lookup = await this.bi.profile(spec.lookupSourceId, actor);
    if (
      !fact.supported ||
      !lookup.supported ||
      fact.dataVersion !== spec.factRevision ||
      lookup.dataVersion !== spec.lookupRevision
    )
      throw new ConflictException('원본 파일이 바뀌었습니다. 품질 미리보기를 다시 확인해 주세요.');
    const inherited = (fact.columns as any[]).filter(c => c.nonAdditive).map(c => c.name);
    spec.definition.nonAdditiveColumns = [
      ...new Set([...spec.definition.nonAdditiveColumns, ...inherited]),
    ].sort();
    const a = await this.current(this.db.manager, spec.factSourceId, actor, spec.factRevision);
    const b = await this.current(this.db.manager, spec.lookupSourceId, actor, spec.lookupRevision);
    const protectedColumns = [
      ...new Set([
        ...spec.definition.nonAdditiveColumns,
        ...spec.definition.attributes
          .filter(attr => {
            const c = (lookup.columns as any[]).find(c => c.name === attr.column);
            return c && (c.nonAdditive || c.numeric || c.type === 'BOOLEAN');
          })
          .map(attr => attr.alias),
      ]),
    ].sort();
    return { spec, fact: a, lookup: b, protectedColumns };
  }
  private result(spec: any, output: any, protectedColumns: string[]) {
    const view = {
      spec,
      quality: output.quality,
      preview: output.preview,
      nonAdditiveColumns: protectedColumns,
    };
    return { ...view, previewDigest: digest(view) };
  }
  private async lookup(fact: string, lookup: string, definition: any, materialize: boolean) {
    try {
      return await this.worker.lookupFiles(fact, lookup, definition, materialize);
    } catch (error) {
      if (error.code === 'FILE_LOOKUP_INVALID') throw new BadRequestException(error.message);
      throw new ServiceUnavailableException(
        '연결 자료를 확인하지 못했습니다. 원본은 유지됩니다. 서버 상태를 확인한 뒤 같은 요청으로 다시 확인해 주세요.',
      );
    }
  }
  async preview(input: any, actor: number) {
    this.access.actor(actor);
    const { spec, fact, lookup, protectedColumns } = await this.prepare(input, actor);
    try {
      const output = await this.lookup(
        fact.config.connection.filename,
        lookup.config.connection.filename,
        spec.definition,
        false,
      );
      await this.current(this.db.manager, spec.factSourceId, actor, spec.factRevision);
      await this.current(this.db.manager, spec.lookupSourceId, actor, spec.lookupRevision);
      return this.result(spec, output, protectedColumns);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException(
        '연결 자료를 확인하지 못했습니다. 원본은 유지됩니다. 같은 요청으로 다시 확인해 주세요.',
      );
    }
  }
  private async replay(
    manager: EntityManager,
    actor: number,
    requestId: string,
    payloadDigest: string,
  ) {
    const receipt = await manager.findOneBy(SourceModelReceipt, { actorId: actor, requestId });
    if (!receipt) return;
    if (receipt.payloadDigest !== payloadDigest)
      throw new ConflictException('같은 저장 요청의 내용이 달라졌습니다.');
    const source =
      receipt.sourceId &&
      (await manager.findOneBy(Database, { id: receipt.sourceId, ownerId: actor }));
    if (!source)
      throw new NotFoundException(
        '저장한 연결 소스를 사용할 수 없습니다. 자동으로 다시 만들지 않습니다.',
      );
    return { id: source.id, name: source.name, replayed: true };
  }
  async save(body: any, actor: number) {
    this.access.actor(actor);
    if (
      !body ||
      Object.keys(body).sort().join(',') !== 'keepUnmatched,name,previewDigest,requestId,spec' ||
      typeof body.requestId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        body.requestId,
      ) ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 100 ||
      typeof body.keepUnmatched !== 'boolean' ||
      !HEX.test(body.previewDigest)
    )
      throw new BadRequestException('연결 소스의 이름과 확인한 저장 요청을 확인해 주세요.');
    const specInput = this.spec(body.spec),
      requestId = body.requestId.toLowerCase(),
      name = body.name.trim();
    const payloadDigest = digest({
      spec: specInput,
      previewDigest: body.previewDigest,
      name,
      keepUnmatched: body.keepUnmatched,
    });
    const prior = await this.replay(this.db.manager, actor, requestId, payloadDigest);
    if (prior) return prior;
    const { spec, fact, lookup, protectedColumns } = await this.prepare(specInput, actor);
    let output: any,
      retained = false;
    try {
      output = await this.lookup(
        fact.config.connection.filename,
        lookup.config.connection.filename,
        spec.definition,
        true,
      );
      if (!output.quality.ready || !output.filename)
        throw new BadRequestException(
          '사전 키의 중복·빈 값을 먼저 수정해 주세요. 원본은 유지됩니다.',
        );
      if (this.result(spec, output, protectedColumns).previewDigest !== body.previewDigest)
        throw new ConflictException('확인한 연결 미리보기가 달라졌습니다. 다시 확인해 주세요.');
      if (output.quality.unmatchedFactRows && !body.keepUnmatched)
        throw new BadRequestException('미매칭 행을 원본 그대로 유지할지 명시적으로 확인해 주세요.');
      // A model is a full snapshot on disk like an upload, so it counts against the same limits. Checked
      // here, not inside the SERIALIZABLE transaction below: on MySQL that would turn the read of the
      // user's sources into locks on an unindexed table for as long as the directories are walked. The
      // price is that two saves racing can both pass by one. A refusal leaves its candidate to the
      // cleanup in the finally.
      await this.storage?.assertWithin(this.db.manager, actor, {
        bytes: await this.worker.directoryBytes(path.dirname(output.filename)),
        newSource: true,
      });
      const transaction = () =>
        serializedViewWrite(this.db.getRepository(Database), () =>
          this.db.transaction('SERIALIZABLE', async manager => {
            const replay = await this.replay(manager, actor, requestId, payloadDigest);
            if (replay) return replay;
            const receipt = await manager.save(SourceModelReceipt, {
              actorId: actor,
              requestId,
              payloadDigest,
              sourceId: null,
            });
            for (const id of [spec.factSourceId, spec.lookupSourceId].sort((a, b) => a - b))
              await this.current(
                manager,
                id,
                actor,
                id === spec.factSourceId ? spec.factRevision : spec.lookupRevision,
                true,
              );
            const config = {
              client: 'duckdb',
              connection: { filename: output.filename },
              useNullAsDefault: true,
              fileVersions: [
                {
                  id: path.basename(path.dirname(output.filename)),
                  filename: output.filename,
                  originalname: name + '.duckdb',
                  rows: output.quality.outputRows,
                  uploadedAt: new Date().toISOString(),
                },
              ],
              fileModel: {
                schemaVersion: 1,
                type: 'lookup',
                spec,
                quality: output.quality,
                grain: 'one output row per fact row',
                nonAdditiveColumns: protectedColumns,
              },
            };
            const source = await manager.save(Database, {
              name,
              description: '연결 모델 · 원본 행 기준의 고정 스냅샷',
              ownerId: actor,
              engine: 'duckdb',
              type: 'duckdb',
              timezone: 'UTC',
              connectionConfig: encryptConnectionConfig(JSON.stringify(config)),
            });
            await manager.update(SourceModelReceipt, receipt.id, { sourceId: source.id });
            return { id: source.id, name: source.name, replayed: false };
          }),
        );
      let result: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          result = await transaction();
          break;
        } catch (error) {
          const code = String(error?.driverError?.code ?? error?.code ?? '');
          if (
            ![
              'SQLITE_BUSY',
              'SQLITE_LOCKED',
              'SQLITE_CONSTRAINT',
              'SQLITE_CONSTRAINT_UNIQUE',
              'ER_DUP_ENTRY',
              'ER_LOCK_DEADLOCK',
              'ER_LOCK_WAIT_TIMEOUT',
              '40001',
              '40P01',
              '55P03',
              '40001',
            ].includes(code)
          )
            throw error;
          const replay = await this.replay(this.db.manager, actor, requestId, payloadDigest);
          if (replay) {
            result = replay;
            break;
          }
          if (attempt === 2)
            throw new ServiceUnavailableException(
              '연결 소스 저장이 다른 요청과 겹쳤습니다. 새 요청 대신 같은 저장 요청으로 확인해 주세요.',
            );
          await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)));
        }
      }
      const saved = await this.db.manager.findOneBy(Database, { id: result.id, ownerId: actor });
      retained =
        !!saved &&
        JSON.parse(decryptConnectionConfig(saved.connectionConfig)).connection?.filename ===
          output.filename;
      if (retained)
        await this.worker.registerImport(output.filename, result.id).catch(() => undefined);
      return result;
    } finally {
      if (output?.filename && !retained) {
        // A lost commit reply cannot justify deleting its now-referenced candidate.
        let unreferenced = false;
        try {
          const receipt = await this.db.manager.findOneBy(SourceModelReceipt, {
            actorId: actor,
            requestId,
          });
          const source =
            receipt?.sourceId &&
            (await this.db.manager.findOneBy(Database, { id: receipt.sourceId }));
          unreferenced =
            !source ||
            JSON.parse(decryptConnectionConfig(source.connectionConfig)).connection?.filename !==
              output.filename;
        } catch {
          /* Unknown metadata state: keep the candidate for later reconciliation. */
        }
        if (unreferenced) await this.worker.discardImport(output.filename).catch(() => undefined);
      }
    }
  }
}
