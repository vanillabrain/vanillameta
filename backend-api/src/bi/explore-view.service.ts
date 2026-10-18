import { lockMetricReferences } from '../metric/metric-write-lock';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonalView } from '../dashboard/entities/personal-view.entity';
import { Database } from '../database/entities/database.entity';
import { serializedViewWrite } from '../dashboard/view-write-queue';
import { metadataTransaction } from '../common/metadata-work';
import { SourceAccessService } from '../ownership/source-access.service';
import { BiExploreService } from './bi-explore.service';
import { validateExploreViewState } from './explore-view-state';

@Injectable()
export class ExploreViewService {
  constructor(
    @InjectRepository(PersonalView) private readonly views: Repository<PersonalView>,
    private readonly access: SourceAccessService,
    private readonly explore: BiExploreService,
  ) {}
  private success(data: any) {
    return { status: 'SUCCESS', data };
  }
  private publicView(row: PersonalView) {
    return {
      id: row.id,
      name: row.name,
      revision: row.revision,
      state: JSON.parse(row.state),
      createdAt: row.createdAt,
    };
  }
  private conflict() {
    throw new ConflictException(
      '지표·열 정의가 변경되었습니다. 카탈로그를 새로 불러온 뒤 현재 조건을 새 보기로 저장해 주세요.',
    );
  }
  async list(source: unknown, actor: number) {
    const sourceId = this.access.id(source);
    await this.access.assert('database', sourceId, actor, 'read');
    const rows = await this.views.find({
      where: { sourceId, userId: actor },
      order: { id: 'DESC' },
      take: 20,
    });
    return this.success(rows.map(row => this.publicView(row)));
  }
  async create(source: unknown, actor: number, body: any) {
    const sourceId = this.access.id(source);
    await this.access.assert('database', sourceId, actor, 'read');
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(k => !['name', 'state', 'revision'].includes(k)) ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 80
    )
      throw new BadRequestException('보기 이름은 1~80자로 입력해 주세요.');
    const sourceBefore = await this.views.manager.findOne(Database, { where: { id: sourceId } });
    const catalog = await this.explore.catalog({ sourceId }, actor);
    if (!/^[a-f0-9]{64}$/.test(body.revision ?? '') || body.revision !== catalog.viewRevision)
      this.conflict();
    const state = validateExploreViewState(body.state, catalog);
    const row = await serializedViewWrite(this.views, async () => {
      await this.access.assert('database', sourceId, actor, 'read');
      return metadataTransaction(this.views.manager, async manager => {
        const metrics = await lockMetricReferences(manager, sourceId, state.measureIds);
        const sourceRow = await manager.findOne(Database, { where: { id: sourceId } });
        if (!sourceBefore || sourceRow.connectionConfig !== sourceBefore.connectionConfig)
          this.conflict();
        await this.access.assert('database', sourceId, actor, 'read', manager);
        for (const [id, metric] of metrics) {
          const expected = catalog.measures.find(measure => measure.id === id);
          if (!expected || JSON.stringify(expected.definition) !== metric.definition)
            this.conflict();
        }
        const repo = manager.getRepository(PersonalView);
        if ((await repo.count({ where: { sourceId, userId: actor } })) >= 20)
          throw new BadRequestException(
            '개인 탐색 보기는 소스별 최대 20개까지 저장할 수 있습니다.',
          );
        return repo.save(
          repo.create({
            sourceId,
            dashboardId: null,
            userId: actor,
            name: body.name.trim(),
            revision: body.revision,
            state: JSON.stringify(state),
          }),
        );
      });
    });
    return this.success(this.publicView(row));
  }
  async load(source: unknown, view: unknown, actor: number) {
    const sourceId = this.access.id(source),
      viewId = this.access.id(view);
    await this.access.assert('database', sourceId, actor, 'read');
    const row = await this.views.findOne({ where: { id: viewId, sourceId, userId: actor } });
    if (!row) throw new NotFoundException('탐색 저장 보기를 찾을 수 없습니다.');
    const catalog = await this.explore.catalog({ sourceId }, actor);
    if (row.revision !== catalog.viewRevision) this.conflict();
    const state = validateExploreViewState(JSON.parse(row.state), catalog);
    await this.access.assert('database', sourceId, actor, 'read');
    return this.success({ ...this.publicView(row), state, resolvedDateRange: state.dateRange });
  }
  async remove(source: unknown, view: unknown, actor: number) {
    const sourceId = this.access.id(source),
      viewId = this.access.id(view);
    await this.access.assert('database', sourceId, actor, 'read');
    const result = await serializedViewWrite(this.views, async () => {
      await this.access.assert('database', sourceId, actor, 'read');
      return this.views.delete({ id: viewId, sourceId, userId: actor });
    });
    if (!result.affected) throw new NotFoundException('탐색 저장 보기를 찾을 수 없습니다.');
    return this.success({ id: viewId });
  }
}
