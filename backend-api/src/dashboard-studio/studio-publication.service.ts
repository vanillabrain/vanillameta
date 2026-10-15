import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, IsNull } from 'typeorm';
import { StudioPublication, StudioPublicationRequest } from './entities/studio-publication.entity';
import { StudioService } from './studio.service';
import { studioDigest } from './studio-legacy';
import { studioKeys } from './studio-document';
import { PublicationMetadata, PublicationSnapshot } from './studio-publication-contract';
import { STUDIO_BREAKPOINTS, StudioDocumentV1 } from './studio-contract';

@Injectable()
export class StudioPublicationService {
  constructor(private readonly db: DataSource, private readonly studio: StudioService) {}
  private metadata(row: StudioPublication): PublicationMetadata {
    return {
      token: row.token,
      version: row.version,
      visibility: row.visibility,
      allowRemix: row.allowRemix,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      asOf: row.asOf,
      dataVersion: row.dataVersion,
      dashboardId: row.dashboardId,
    };
  }
  private validate(id: number, body: any) {
    try {
      studioKeys(body, ['requestId', 'expectedRevision', 'visibility', 'allowRemix', 'expiresAt']);
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        typeof body.requestId !== 'string' ||
        !/^[-a-zA-Z0-9_]{1,128}$/.test(body.requestId) ||
        typeof body.expectedRevision !== 'string' ||
        !/^[a-f0-9]{64}$/.test(body.expectedRevision) ||
        typeof body.visibility !== 'string' ||
        !['private', 'link'].includes(body.visibility) ||
        typeof body.allowRemix !== 'boolean' ||
        (body.expiresAt !== undefined &&
          (typeof body.expiresAt !== 'string' ||
            !/^\d{4}-\d\d-\d\dT/.test(body.expiresAt) ||
            !Number.isFinite(Date.parse(body.expiresAt))))
      )
        throw new Error();
    } catch {
      throw new BadRequestException('게시 범위와 만료 시간을 확인해 주세요.');
    }
  }
  async ownerMetadata(id: number, actor: number) {
    await this.studio.assertPublicationOwner(id, actor);
    return this.studio.serializeWrite(async () => {
      const row = await this.db.manager.findOne(StudioPublication, {
        where: { dashboardId: id, actorId: actor, revokedAt: IsNull() },
        order: { createdAt: 'DESC', token: 'DESC' },
      });
      return row ? this.metadata(row) : null;
    });
  }
  /** Durable outcome lookup for coordinator recovery, including historical request result after republish. */
  async committed(
    requestId: string,
    actor: number,
    serialize = true,
  ): Promise<PublicationMetadata | undefined> {
    const read = async () => {
      const row = await this.db.manager.findOne(StudioPublicationRequest, {
        where: { actorId: actor, requestId },
      });
      if (!row) return undefined;
      const result = JSON.parse(row.result);
      // Current revoke status must never imply an old successful request reactivated a token.
      const current = await this.db.manager.findOne(StudioPublication, {
        where: { token: result.token },
      });
      return { ...result, revokedAt: current?.revokedAt ?? result.revokedAt };
    };
    return serialize ? this.studio.serializeWrite(read) : read();
  }
  async publish(
    id: number,
    body: any,
    actor: number,
    signal?: AbortSignal,
  ): Promise<PublicationMetadata> {
    this.validate(id, body);
    await this.studio.assertPublicationOwner(id, actor);
    const payloadHash = studioDigest({ dashboardId: id, ...body });
    return this.studio.serializeWrite(async () => {
      await this.studio.assertPublicationOwner(id, actor);
      const prior = await this.db.manager.findOne(StudioPublicationRequest, {
        where: { actorId: actor, requestId: body.requestId },
      });
      if (prior) {
        if (prior.payloadHash !== payloadHash)
          throw new ConflictException('같은 게시 요청 ID에 다른 내용을 보낼 수 없습니다.');
        return this.committed(body.requestId, actor, false);
      }
      if (body.expiresAt !== undefined && Date.parse(body.expiresAt) <= Date.now())
        throw new BadRequestException('만료 시간은 현재보다 뒤로 지정해 주세요.');
      const check = () => {
        if (signal?.aborted) throw new BadRequestException('게시 요청을 취소했습니다.');
      };
      check();
      return this.studio.publicationSnapshot(
        id,
        body.expectedRevision,
        actor,
        async ({ document, preview, dataVersion }, manager) => {
          const snapshot = this.sanitize(document, preview);
          const encoded = JSON.stringify(snapshot);
          if (Buffer.byteLength(encoded, 'utf8') > 2 * 1024 * 1024)
            throw new PayloadTooLargeException(
              '게시 데이터가 2MiB를 초과합니다. 차트나 표시 그룹을 줄여 주세요. 이전 게시 내용은 유지됩니다.',
            );
          check();
          await this.studio.assertPublicationOwner(id, actor);
          const old = await manager.findOne(StudioPublication, {
            where: { dashboardId: id, actorId: actor, revokedAt: IsNull() },
            order: { createdAt: 'DESC', token: 'DESC' },
          });
          const row = await manager.save(StudioPublication, {
            ...(old ?? {}),
            token: old?.token ?? randomBytes(32).toString('hex'),
            actorId: actor,
            dashboardId: id,
            sourceId: document.sourceId,
            version: (old?.version ?? 0) + 1,
            visibility: body.visibility,
            allowRemix: body.allowRemix,
            expiresAt: body.expiresAt ? new Date(body.expiresAt).toISOString() : null,
            revokedAt: null,
            asOf: new Date().toISOString(),
            dataVersion,
            snapshot: encoded,
          });
          const result = this.metadata(row);
          await manager.insert(StudioPublicationRequest, {
            actorId: actor,
            requestId: body.requestId,
            payloadHash,
            result: JSON.stringify(result),
          });
          check();
          return result;
        },
      );
    });
  }
  private async find(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new NotFoundException('공유 링크를 찾을 수 없습니다.');
    const row = await this.db.manager.findOne(StudioPublication, { where: { token } });
    if (!row) throw new NotFoundException('공유 링크를 찾을 수 없습니다.');
    return row;
  }
  async read(token: string, actor?: number) {
    return this.studio.serializeWrite(async () => {
      const row = await this.find(token);
      if (row.revokedAt || (row.expiresAt && Date.parse(row.expiresAt) <= Date.now()))
        throw new GoneException('공유가 중지되었거나 만료되었습니다.');
      if (row.visibility === 'private' && row.actorId !== actor)
        throw new ForbiddenException('소유자만 볼 수 있는 비공개 게시입니다.');
      await this.studio.assertExecutionAccess(row.dashboardId, row.sourceId, row.actorId);
      const metadata: Partial<PublicationMetadata> = this.metadata(row);
      delete metadata.dashboardId;
      delete metadata.revokedAt;
      return { ...metadata, snapshot: JSON.parse(row.snapshot) as PublicationSnapshot };
    });
  }
  async revoke(token: string, actor: number): Promise<PublicationMetadata> {
    return this.studio.serializeWrite(async () => {
      const row = await this.find(token);
      if (row.actorId !== actor)
        throw new ForbiddenException('소유자만 공유를 중지할 수 있습니다.');
      await this.studio.assertPublicationOwner(row.dashboardId, actor);
      if (!row.revokedAt) {
        row.revokedAt = new Date().toISOString();
        await this.db.manager.save(StudioPublication, row);
      }
      return this.metadata(row);
    });
  }
  private sanitize(document: StudioDocumentV1, preview: any): PublicationSnapshot {
    const invalid = () => {
      throw new BadRequestException('안전한 집계 결과를 확인할 수 없어 게시하지 않았습니다.');
    };
    if (!Array.isArray(preview?.widgets) || preview.widgets.length !== document.blocks.length)
      invalid();
    const ids = new Map(document.blocks.map((block, i) => [block.id, 'block-' + (i + 1)]));
    const scalar = (value: any): string | number | boolean | null => {
      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
      )
        return value;
      return invalid();
    };
    const blocks = document.blocks.map((block, i) => {
      const widget = preview.widgets[i];
      const names = [
        widget.valueField,
        ...(block.kind === 'BOARD_NUMERIC' ? [] : [widget.categoryField]),
      ];
      if (
        widget.type !== block.kind ||
        widget.grainUnavailable ||
        names.some(
          n => typeof n !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(n),
        ) ||
        new Set(names).size !== names.length ||
        !Array.isArray(widget.datas) ||
        !Array.isArray(widget.fields)
      )
        invalid();
      if (block.kind === 'BOARD_NUMERIC' && widget.datas.length !== 1) invalid();
      const fields = names.map(name => {
        const f = widget.fields.find(f => f.columnName === name);
        if (!f || !['number', 'string', 'boolean', 'date', 'datetime'].includes(f.columnType))
          invalid();
        return { columnName: name, columnType: f.columnType };
      });
      const display = Object.fromEntries(
        ['timeGrain', 'decimalPlaces', 'numberNotation', 'prefix', 'suffix']
          .filter(k => block.display[k] !== undefined)
          .map(k => [k, block.display[k]]),
      );
      const trend = widget.trend;
      if (
        trend &&
        (!Array.isArray(trend.points) ||
          !['auto', 'hour', 'day', 'week', 'month', 'minute'].includes(trend.grain))
      )
        invalid();
      return {
        id: ids.get(block.id),
        title: block.title,
        description: block.description,
        kind: block.kind,
        display,
        valueField: widget.valueField,
        ...(block.kind === 'BOARD_NUMERIC' ? {} : { categoryField: widget.categoryField }),
        fields,
        datas: widget.datas.map(row =>
          Object.fromEntries(names.map(name => [name, scalar(row[name])])),
        ),
        ...(trend
          ? {
              trend: {
                grain: trend.grain,
                ...(trend.timeZone ? { timeZone: String(trend.timeZone) } : {}),
                points: trend.points.map(p => {
                  if (
                    typeof p.time !== 'string' ||
                    !(
                      p.value === null ||
                      typeof p.value === 'string' ||
                      typeof p.value === 'number'
                    )
                  )
                    invalid();
                  return { time: p.time, value: scalar(p.value) as string | number | null };
                }),
              },
            }
          : {}),
      };
    });
    return {
      title: document.title,
      periodLabel: '전체 기간',
      filters: [],
      blocks,
      layouts: Object.fromEntries(
        STUDIO_BREAKPOINTS.map(bp => [
          bp,
          document.layouts[bp].map(g => ({ id: ids.get(g.id), x: g.x, y: g.y, w: g.w, h: g.h })),
        ]),
      ) as PublicationSnapshot['layouts'],
    };
  }
}
