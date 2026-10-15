import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AiDashboardService } from '../ai/ai-dashboard.service';
import { ConnectionService } from '../connection/connection.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { Database } from '../database/entities/database.entity';
import { StudioRemixRequest } from './entities/studio-remix.entity';
import { StudioService } from './studio.service';
import { StudioCreationService } from './studio-creation.service';
import { StudioPublicationService } from './studio-publication.service';
import { studioDigest } from './studio-legacy';
import { studioKeys } from './studio-document';
import {
  RemixField,
  RemixPreview,
  RemixPreviewRequest,
  RemixRequest,
  RemixRequirements,
  RemixTemplate,
} from './studio-remix-contract';
@Injectable()
export class StudioRemixService {
  constructor(
    private readonly db: DataSource,
    private readonly studio: StudioService,
    private readonly publications: StudioPublicationService,
    private readonly creation: StudioCreationService,
    private readonly dashboards: AiDashboardService,
    private readonly connection: ConnectionService,
    private readonly access: SourceAccessService,
  ) {}
  private requirements(token: string, version: number, t: RemixTemplate): RemixRequirements {
    return {
      token,
      version,
      title: t.title,
      requiredFields: t.requiredFields,
      blocks: t.blocks.map(({ id, title, kind, supported, reason }) => ({
        id,
        title,
        kind,
        supported,
        ...(reason ? { reason } : {}),
      })),
    };
  }
  async template(token: string, actor: number) {
    this.access.actor(actor);
    return this.studio.serializeWrite(async () => {
      const row = await this.publications.requireRemix(token, actor);
      return this.requirements(token, row.version, JSON.parse(row.remixTemplate));
    });
  }
  private validate(body: any, save: boolean): RemixRequest {
    try {
      (studioKeys as (value: any, keys: string[]) => void)(body, [
        'targetSourceId',
        'mapping',
        'excludedBlockIds',
        'expectedVersion',
        ...(save ? ['requestId', 'expectedSourceRevision'] : []),
      ]);
      if (
        !Number.isSafeInteger(body.targetSourceId) ||
        body.targetSourceId <= 0 ||
        !body.mapping ||
        typeof body.mapping !== 'object' ||
        Array.isArray(body.mapping) ||
        Object.keys(body.mapping).length > 128 ||
        Object.entries(body.mapping).some(
          ([k, v]) =>
            !k ||
            k.length > 256 ||
            ['__proto__', 'constructor', 'prototype'].includes(k) ||
            typeof v !== 'string' ||
            v.length > 256,
        ) ||
        (body.expectedVersion !== undefined &&
          (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1)) ||
        (body.excludedBlockIds !== undefined &&
          (!Array.isArray(body.excludedBlockIds) ||
            body.excludedBlockIds.length > 6 ||
            new Set(body.excludedBlockIds).size !== body.excludedBlockIds.length ||
            body.excludedBlockIds.some(id => typeof id !== 'string'))) ||
        (save &&
          (typeof body.requestId !== 'string' ||
            !/^[-a-zA-Z0-9_]{1,128}$/.test(body.requestId) ||
            body.expectedVersion === undefined ||
            typeof body.expectedSourceRevision !== 'string' ||
            !/^[a-f0-9]{64}$/.test(body.expectedSourceRevision)))
      )
        throw new Error();
      return {
        ...body,
        mapping: { ...body.mapping },
        excludedBlockIds: body.excludedBlockIds ?? [],
      };
    } catch {
      throw new BadRequestException('복제 요청과 기준 버전을 확인해 주세요.');
    }
  }
  private map(t: RemixTemplate, body: RemixPreviewRequest, profile: any) {
    if (
      Object.keys(body.mapping).some(name => !t.requiredFields.some(f => f.name === name)) ||
      body.excludedBlockIds.some(id => !t.blocks.some(b => b.id === id))
    )
      throw new BadRequestException('알 수 없는 열 또는 제외 블록입니다.');
    const fields: RemixField[] = t.requiredFields.map(f => {
      const candidates = profile.columns.filter(c => c.type === f.type).map(c => c.name);
      const targetColumn = Object.prototype.hasOwnProperty.call(body.mapping, f.name)
        ? body.mapping[f.name]
        : profile.columns.find(c => c.name === f.name && c.type === f.type)?.name;
      const target = profile.columns.find(c => c.name === targetColumn);
      return {
        sourceColumn: f.name,
        sourceType: f.type,
        ...(targetColumn ? { targetColumn } : {}),
        candidates,
        status:
          targetColumn === ''
            ? 'missing'
            : targetColumn
            ? target?.type === f.type
              ? 'mapped'
              : 'incompatible'
            : candidates.length > 1
            ? 'ambiguous'
            : 'missing',
      };
    });
    const mapping = Object.fromEntries(
      fields
        .filter(f => f.status === 'mapped' || body.mapping[f.sourceColumn] === '')
        .map(f => [f.sourceColumn, f.targetColumn ?? '']),
    );
    const kept = t.blocks.filter(b => !body.excludedBlockIds.includes(b.id));
    const unmappedBlocks = kept.flatMap(block => {
      const missingFields = fields
        .filter(
          f =>
            f.status !== 'mapped' &&
            t.requiredFields.find(r => r.name === f.sourceColumn).blockIds.includes(block.id),
        )
        .map(f => f.sourceColumn);
      return !block.supported || missingFields.length
        ? [
            {
              blockId: block.id,
              title: block.title,
              reason: block.reason ?? '필수 열의 매핑과 타입을 확인해 주세요.',
              missingFields,
            },
          ]
        : [];
    });
    const blocks = kept
      .filter(b => !unmappedBlocks.some(u => u.blockId === b.id))
      .map(b => {
        const metric: any = {
          ...b.metric,
          schemaVersion: 1,
          definitionVersion: 1,
          sourceId: body.targetSourceId,
          tableName: 'uploaded_data',
        };
        for (const key of ['column', 'denominatorColumn', 'weightColumn'])
          if (metric[key] && !(key === 'column' && metric.aggregation === 'COUNT'))
            metric[key] = mapping[metric[key]];
        return {
          blockId: b.id,
          title: b.title,
          description: b.description,
          kind: b.kind,
          display: { ...b.display },
          metric,
          ...(b.dimension
            ? {
                dimension: {
                  column: mapping[b.dimension.column],
                  type: profile.columns.find(c => c.name === mapping[b.dimension.column]).type,
                  schemaVersion: profile.schemaVersion,
                },
              }
            : {}),
        };
      });
    return { fields, mapping, unmappedBlocks, blocks, kept };
  }
  private safePreview(preview: any) {
    return {
      widgets: preview.widgets.map(w => ({
        title: w.title,
        description: w.description,
        type: w.type,
        valueField: w.valueField,
        ...Object.fromEntries(
          ['prefix', 'suffix', 'decimalPlaces', 'numberNotation', 'timeGrain']
            .filter(key => w[key] !== undefined)
            .map(key => [key, w[key]]),
        ),
        ...(w.categoryField ? { categoryField: w.categoryField } : {}),
        fields: w.fields.map(f => ({ columnName: f.columnName, columnType: f.columnType })),
        datas: w.datas.map(row =>
          Object.fromEntries(
            [w.valueField, ...(w.categoryField ? [w.categoryField] : [])].map(key => [
              key,
              row[key],
            ]),
          ),
        ),
        ...(w.grainUnavailable ? { grainUnavailable: w.grainUnavailable } : {}),
        ...(w.trend
          ? {
              trend: {
                grain: w.trend.grain,
                points: w.trend.points.map(p => ({ time: p.time, value: p.value })),
              },
            }
          : {}),
      })),
    };
  }
  async preview(token: string, input: RemixPreviewRequest, actor: number): Promise<RemixPreview> {
    this.access.actor(actor);
    const body = this.validate(input, false);
    return this.studio.serializeWrite(async () => {
      const row = await this.publications.requireRemix(token, actor, body.expectedVersion);
      await this.access.assert('database', body.targetSourceId, actor);
      return this.connection.withDuckDBSnapshot(body.targetSourceId, async () => {
        const profile = await this.creation.profile(body.targetSourceId, actor);
        await this.creation.ensureCurrentSource(body.targetSourceId, actor, this.db.manager);
        const t: RemixTemplate = JSON.parse(row.remixTemplate),
          mapped = this.map(t, body, profile);
        const preview = mapped.blocks.length
          ? this.safePreview(
              (
                await this.dashboards.preview(
                  {
                    draft: this.creation.compile(
                      body.targetSourceId,
                      t.title,
                      mapped.blocks,
                      profile,
                    ),
                    includeTrends: true,
                  },
                  actor,
                )
              ).data,
            )
          : undefined;
        await this.creation.ensureCurrentSource(body.targetSourceId, actor, this.db.manager);
        const latest = await this.creation.profile(body.targetSourceId, actor);
        if (
          latest.dataVersion !== profile.dataVersion ||
          latest.schemaVersion !== profile.schemaVersion
        )
          throw new ConflictException('대상 데이터가 변경되었습니다. 매핑을 다시 확인해 주세요.');
        await this.publications.requireRemix(token, actor, row.version);
        return {
          ...this.requirements(token, row.version, t),
          targetSourceId: body.targetSourceId,
          sourceRevision: profile.dataVersion,
          profile: {
            sourceId: profile.sourceId,
            name: profile.name,
            rowCount: profile.rowCount,
            dataVersion: profile.dataVersion,
            columns: profile.columns.map(({ name, type, numeric, temporal }) => ({
              name,
              type,
              numeric,
              temporal,
            })),
          },
          mapping: mapped.mapping,
          fields: mapped.fields,
          unmappedBlocks: mapped.unmappedBlocks,
          ...(preview ? { preview } : {}),
        };
      });
    });
  }
  private async sourceIdentity(sourceId: number, actor: number, manager: EntityManager) {
    await this.creation.ensureCurrentSource(sourceId, actor, manager);
    const row = await manager.findOne(Database, { where: { id: sourceId } });
    return studioDigest([
      row.id,
      row.ownerId,
      row.engine,
      row.connectionConfig,
      row.createdAt,
      row.updatedAt,
    ]);
  }
  async remix(token: string, input: RemixRequest, actor: number) {
    this.access.actor(actor);
    const body = this.validate(input, true),
      payloadHash = studioDigest({ token, ...body });
    return this.studio.serializeWrite(async () => {
      await this.publications.requireRemix(token, actor, body.expectedVersion);
      await this.access.assert('database', body.targetSourceId, actor);
      const prior = await this.db.manager.findOne(StudioRemixRequest, {
        where: { actorId: actor, requestId: body.requestId },
      });
      if (prior) {
        if (prior.payloadHash !== payloadHash)
          throw new ConflictException('같은 요청 ID에 다른 복제 내용을 보낼 수 없습니다.');
        const result = JSON.parse(prior.result);
        await this.access.dashboard(result.dashboardId, actor);
        return result;
      }
      return this.connection.withDuckDBSnapshot(body.targetSourceId, async () => {
        const profile = await this.creation.profile(body.targetSourceId, actor);
        if (profile.dataVersion !== body.expectedSourceRevision)
          throw new ConflictException('대상 데이터가 변경되었습니다. 매핑을 다시 확인해 주세요.');
        const identity = await this.sourceIdentity(body.targetSourceId, actor, this.db.manager);
        return this.db.transaction(async manager => {
          const row = await this.publications.requireRemix(
            token,
            actor,
            body.expectedVersion,
            manager,
          );
          if (identity !== (await this.sourceIdentity(body.targetSourceId, actor, manager)))
            throw new ConflictException('대상 소스가 변경되었습니다.');
          const t: RemixTemplate = JSON.parse(row.remixTemplate),
            mapped = this.map(t, body, profile);
          if (!mapped.kept.length || mapped.unmappedBlocks.length)
            throw new BadRequestException(
              '남길 블록의 모든 필수 열을 매핑하거나 해당 블록을 명시적으로 제외해 주세요.',
            );
          const result = await this.creation.persistRemix(
            body.targetSourceId,
            t,
            mapped.blocks,
            profile,
            actor,
            manager,
          );
          // Recheck after save/aggregate awaits, including legacy metadata writes outside Studio's queue.
          await this.publications.requireRemix(token, actor, body.expectedVersion, manager);
          const latest = await this.creation.profile(body.targetSourceId, actor);
          if (
            identity !== (await this.sourceIdentity(body.targetSourceId, actor, manager)) ||
            latest.dataVersion !== body.expectedSourceRevision ||
            latest.schemaVersion !== profile.schemaVersion
          )
            throw new ConflictException('저장 중 대상 데이터가 변경되었습니다.');
          await manager.insert(StudioRemixRequest, {
            actorId: actor,
            requestId: body.requestId,
            payloadHash,
            result: JSON.stringify(result),
          });
          return result;
        });
      });
    });
  }
}
