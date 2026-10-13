import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { ConnectionService } from '../connection/connection.service';
import { BiService } from './bi.service';
import { ExploreView } from './entities/explore-view.entity';
import { ExploreViewState, validateExploreViewState } from './explore-view-state';

const MAX_VIEWS_PER_SOURCE = 20;
const MAX_NAME_LENGTH = 80;
const MAX_REVISION_LENGTH = 128;
const CREATE_FIELDS = ['sourceId', 'name', 'sourceRevision', 'state', 'measureVersions'];
const SOURCE_FIELDS = ['sourceId'];
const LOAD_FIELDS = ['sourceId', 'viewId'];
const REMOVE_FIELDS = ['sourceId', 'viewId'];

/** Personal saved exploration views scoped to one private actor and owned managed source. */
@Injectable()
export class ExploreViewService {
  // Local SQLite has one connection; do not overlap this service's write transactions.
  private writeQueue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly db: DataSource,
    private readonly access: SourceAccessService,
    private readonly bi: BiService,
    private readonly connection: ConnectionService,
  ) {}

  /** Strict request schema: an unknown field is a client bug, not a silent extra. */
  private fields(input: unknown, allowed: string[]) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('invalid request body');
    const unknown = Object.keys(input).find(key => !allowed.includes(key));
    if (unknown) throw new BadRequestException(`unsupported field: ${unknown}`);
    return input as Record<string, any>;
  }

  private name(value: unknown) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > MAX_NAME_LENGTH)
      throw new BadRequestException('보기 이름은 1~80자로 입력해 주세요.');
    return value.trim();
  }

  private revision(value: unknown) {
    if (
      typeof value !== 'string' ||
      !value ||
      value.length > MAX_REVISION_LENGTH ||
      !/^[a-f0-9]{64}$/.test(value)
    )
      throw new BadRequestException('sourceRevision is required');
    return value;
  }

  /**
   * Client catalog snapshot for the selected measures. It exists only to detect a stale catalog
   * between the client's read and this save; the row stores the server-derived mapping instead.
   */
  private clientMeasureVersions(value: unknown, measureIds: number[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('measureVersions is required');
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length !== measureIds.length)
      throw new BadRequestException('measureVersions must match the selected measures');
    const versions = new Map<number, number>();
    for (const [key, version] of entries) {
      const id = Number(key);
      // Canonical keys only: '01' or '+1' are aliases of the same id and must not stand in for it.
      if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== key || !measureIds.includes(id))
        throw new BadRequestException('measureVersions must match the selected measures');
      if (!Number.isSafeInteger(version) || Number(version) <= 0)
        throw new BadRequestException('invalid measure definition version');
      versions.set(id, Number(version));
    }
    if (versions.size !== measureIds.length)
      throw new BadRequestException('measureVersions must match the selected measures');
    return versions;
  }

  private write<T>(operation: () => Promise<T>): Promise<T> {
    if (this.db.options.type !== 'sqlite') return operation();
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Full view for a readable row; the state is already validated by the caller. */
  private fullView(row: ExploreView, state: ExploreViewState) {
    return {
      id: row.id,
      name: row.name,
      sourceId: row.sourceId,
      sourceRevision: row.sourceRevision,
      state,
      createdAt: row.createdAt,
    };
  }

  /**
   * Reads a stored row's state. A corrupt or future-version row yields null so one bad row cannot
   * take down the whole list; load treats null as a hard conflict instead.
   */
  private parseState(row: ExploreView): ExploreViewState | null {
    try {
      return validateExploreViewState(JSON.parse(row.state));
    } catch {
      return null;
    }
  }

  /**
   * Stored versions must be a positive integer for exactly the row's measureIds. A malformed map is
   * never silently skipped: it reads as stale and blocks load with a conflict.
   */
  private storedVersions(row: ExploreView, state: ExploreViewState): Map<number, number> | null {
    try {
      const raw = JSON.parse(row.measureVersions || 'null');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const entries = Object.entries(raw as Record<string, unknown>);
      if (entries.length !== state.measureIds.length) return null;
      const versions = new Map<number, number>();
      for (const [key, value] of entries) {
        const id = Number(key);
        if (
          !Number.isSafeInteger(id) ||
          id <= 0 ||
          String(id) !== key ||
          !state.measureIds.includes(id)
        )
          return null;
        if (!Number.isSafeInteger(value) || Number(value) <= 0) return null;
        versions.set(id, Number(value));
      }
      // An alias key would leave a selected measure unchecked; a short map is malformed.
      if (versions.size !== state.measureIds.length) return null;
      return versions;
    } catch {
      return null;
    }
  }

  /**
   * List entry. An unreadable row degrades to a delete-capable summary without its state; a
   * readable row is stale when its stored source revision or any stored version no longer matches.
   */
  private summary(
    row: ExploreView,
    current: { sourceRevision: string; versions: Map<number, number> } | null,
  ) {
    const state = this.parseState(row);
    if (!state)
      return {
        id: row.id,
        name: row.name,
        sourceId: row.sourceId,
        sourceRevision: row.sourceRevision,
        createdAt: row.createdAt,
        stale: true,
        unreadable: true,
      };
    return { ...this.fullView(row, state), stale: this.isStale(row, current) };
  }

  private success(data: any) {
    return { status: 'SUCCESS', data };
  }

  /** Current file revision plus each measure's definitionVersion, or null when unreadable. */
  private async currentVersions(
    sourceId: number,
    actor: number,
  ): Promise<{ sourceRevision: string; versions: Map<number, number> } | null> {
    try {
      return await this.connection.withDuckDBSnapshot(sourceId, async () => {
        const profile = await this.bi.profile(sourceId, actor);
        if (!profile.supported) return null;
        const sourceRevision = await this.connection.duckDBVersion(profile.sourceId);
        const metrics = await this.bi.metrics(profile.sourceId, actor);
        return {
          sourceRevision,
          versions: new Map(metrics.map(measure => [measure.id, measure.definitionVersion])),
        };
      });
    } catch {
      return null;
    }
  }

  private isStale(
    row: ExploreView,
    current: { sourceRevision: string; versions: Map<number, number> } | null,
  ) {
    const state = this.parseState(row);
    if (!state) return true;
    const stored = this.storedVersions(row, state);
    if (!stored) return true;
    if (!current || current.sourceRevision !== row.sourceRevision) return true;
    for (const [id, version] of stored) if (current.versions.get(id) !== version) return true;
    return false;
  }

  /**
   * Server-derived mapping. A missing or invalid current definitionVersion is rejected instead of
   * inserting a row whose JSON.stringify would silently drop the undefined entry.
   */
  private serverMeasureVersions(state: ExploreViewState, metrics: any[]) {
    const versions: Record<number, number> = {};
    for (const id of state.measureIds) {
      const version = metrics.find((measure: any) => measure.id === id).definitionVersion;
      if (!Number.isSafeInteger(version) || Number(version) <= 0)
        throw new BadRequestException('지표 정의 버전을 확인할 수 없습니다.');
      versions[id] = Number(version);
    }
    return versions;
  }

  /** Catalog membership and temporal bounds; never runs the heavy aggregate query. */
  private validateAgainstCatalog(state: ExploreViewState, profile: any, metrics: any[]) {
    const columns = new Set(profile.columns.map((column: any) => column.name));
    const numeric = new Set(
      profile.columns.filter((column: any) => column.numeric).map((column: any) => column.name),
    );
    const temporal = new Map<string, any>(
      profile.columns
        .filter((column: any) => column.temporal)
        .map((column: any) => [column.name, column]),
    );
    for (const name of state.dimensionColumns)
      if (!columns.has(name)) throw new BadRequestException('unknown dimension column');
    // Version 2 stores a pivot layout beside the dimension columns; each axis name must exist in
    // the same catalog the query runs against.
    if (state.version === 2)
      for (const name of state.pivot.rowColumns.concat(state.pivot.columnColumns))
        if (!columns.has(name)) throw new BadRequestException('unknown pivot column');
    for (const filter of state.filters) {
      if (!columns.has(filter.column)) throw new BadRequestException('unknown filter column');
      if ('range' in filter && !numeric.has(filter.column))
        throw new BadRequestException('숫자 열에만 범위 필터를 적용할 수 있습니다.');
    }
    const known = new Set(metrics.map(measure => measure.id));
    for (const id of state.measureIds)
      if (!known.has(id)) throw new BadRequestException('unknown measure id');
    if (state.dateRange) this.validatePeriodColumn(state.dateRange, temporal);
  }

  /**
   * Only temporal column membership is required: the exploration query intentionally allows empty
   * or out-of-data periods, and a UTC min/max differs from a regional calendar date, so comparing
   * stored bounds would reject valid queries. Range validity is enforced by the state validator.
   */
  private validatePeriodColumn(dateRange: any, temporal: Map<string, any>) {
    if (!temporal.has(dateRange.column)) throw new BadRequestException('unknown date column');
  }

  /** MySQL admission serializes on the existing source row across server instances. */
  private async lockSource(manager: EntityManager, sourceId: number) {
    if (manager.connection.options.type !== 'mysql') return;
    await manager.findOne(Database, {
      where: { id: sourceId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async list(body: any, actor: number) {
    const input = this.fields(body, SOURCE_FIELDS);
    const sourceId = this.access.id(input.sourceId);
    await this.access.assert('database', sourceId, actor);
    const rows = await this.db.getRepository(ExploreView).find({
      where: { sourceId, userId: actor },
      order: { id: 'DESC' },
      take: MAX_VIEWS_PER_SOURCE,
    });
    const current = await this.currentVersions(sourceId, actor);
    return this.success(rows.map(row => this.summary(row, current)));
  }

  async create(body: any, actor: number) {
    const input = this.fields(body, CREATE_FIELDS);
    const name = this.name(input.name);
    const expected = this.revision(input.sourceRevision);
    const state = validateExploreViewState(input.state);
    const clientVersions = this.clientMeasureVersions(input.measureVersions, state.measureIds);
    const sourceId = this.access.id(input.sourceId);
    await this.access.assert('database', sourceId, actor);
    return this.write(async () => {
      await this.access.assert('database', sourceId, actor);
      // Hold the pinned file for the reads and the insert so a new upload cannot race the row.
      return this.connection.withDuckDBSnapshot(sourceId, async () => {
        const profile = await this.bi.profile(sourceId, actor);
        if (!profile.supported)
          throw new BadRequestException('서버에 저장한 DuckDB 파일을 선택해 주세요.');
        const sourceRevision = await this.connection.duckDBVersion(profile.sourceId);
        if (sourceRevision !== expected)
          throw new ConflictException(
            '파일 버전이 변경되었습니다. 소스를 새로고침한 뒤 다시 시도해 주세요.',
          );
        const metrics = await this.bi.metrics(profile.sourceId, actor);
        this.validateAgainstCatalog(state, profile, metrics);
        const measureVersions = this.serverMeasureVersions(state, metrics);
        for (const id of state.measureIds)
          if (clientVersions.get(id) !== measureVersions[id])
            throw new ConflictException(
              '지표 정의가 변경되었습니다. 조건을 다시 확인하고 새 보기로 저장해 주세요.',
            );
        const row = await this.db.transaction(async manager => {
          await this.lockSource(manager, sourceId);
          const repo = manager.getRepository(ExploreView);
          if ((await repo.count({ where: { sourceId, userId: actor } })) >= MAX_VIEWS_PER_SOURCE)
            throw new BadRequestException('탐색 보기는 소스별 최대 20개까지 저장할 수 있습니다.');
          return repo.save(
            repo.create({
              sourceId,
              userId: actor,
              name,
              sourceRevision: expected,
              measureVersions: JSON.stringify(measureVersions),
              state: JSON.stringify(state),
            }),
          );
        });
        return this.success(this.fullView(row, state));
      });
    });
  }

  async load(body: any, actor: number) {
    const input = this.fields(body, LOAD_FIELDS);
    const sourceId = this.access.id(input.sourceId);
    await this.access.assert('database', sourceId, actor);
    const row = await this.db.getRepository(ExploreView).findOne({
      where: { id: this.access.id(input.viewId), sourceId, userId: actor },
    });
    if (!row) throw new NotFoundException('저장 보기를 찾을 수 없습니다.');
    const state = this.parseState(row);
    if (!state)
      throw new ConflictException('저장 보기의 상태를 읽을 수 없습니다. 새 보기로 저장해 주세요.');
    const stored = this.storedVersions(row, state);
    if (!stored)
      throw new ConflictException(
        '저장 보기의 지표 버전 정보를 확인할 수 없습니다. 새 보기로 저장해 주세요.',
      );
    const current = await this.currentVersions(sourceId, actor);
    if (!current || current.sourceRevision !== row.sourceRevision)
      throw new ConflictException(
        '파일 버전이 변경되었습니다. 소스를 새로고침한 뒤 다시 시도해 주세요.',
      );
    for (const [id, version] of stored)
      if (current.versions.get(id) !== version)
        throw new ConflictException(
          '지표 정의가 변경되었습니다. 조건을 다시 확인하고 새 보기로 저장해 주세요.',
        );
    return this.success(this.fullView(row, state));
  }

  async remove(body: any, actor: number) {
    const input = this.fields(body, REMOVE_FIELDS);
    const sourceId = this.access.id(input.sourceId);
    const viewId = this.access.id(input.viewId);
    await this.access.assert('database', sourceId, actor);
    const result = await this.write(async () => {
      await this.access.assert('database', sourceId, actor);
      return this.db.getRepository(ExploreView).delete({ id: viewId, sourceId, userId: actor });
    });
    if (!result.affected) throw new NotFoundException('저장 보기를 찾을 수 없습니다.');
    return this.success({ id: viewId });
  }
}
