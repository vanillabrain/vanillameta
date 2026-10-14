import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { SourceAccessService } from '../ownership/source-access.service';
import { serializedViewWrite } from '../dashboard/view-write-queue';
import { ExploreViewService } from './explore-view.service';
import { BiExploreService } from './bi-explore.service';
import { validateExploreViewState } from './explore-view-state';
@Injectable()
export class DashboardPivotService {
  constructor(
    @InjectRepository(Dashboard) private readonly dashboards: Repository<Dashboard>,
    private readonly access: SourceAccessService,
    private readonly views: ExploreViewService,
    private readonly explore: BiExploreService,
  ) {}
  private items(row: Dashboard): any[] {
    const items = row.pivotDefinitions ? JSON.parse(row.pivotDefinitions) : [];
    if (!Array.isArray(items) || items.length > 8)
      throw new ConflictException('Pivot 설정을 확인할 수 없습니다.');
    return items;
  }
  private source(row: Dashboard): number {
    const source = row.analysisDefinition && JSON.parse(row.analysisDefinition).databaseId;
    if (!Number.isSafeInteger(source) || source <= 0)
      throw new BadRequestException('공통 필터가 있는 데이터 분석 대시보드를 선택해 주세요.');
    return source;
  }
  async list(id: unknown, actor: number) {
    const dashboardId = this.access.id(id);
    await this.access.assert('dashboard', dashboardId, actor);
    const row = await this.dashboards.findOneBy({ id: dashboardId });
    const items = this.items(row);
    if (!items.length) return { status: 'SUCCESS', data: [] };
    const sourceId = this.source(row);
    const catalog = await this.explore.catalog({ sourceId }, actor);
    const data = items.map(item => {
      if (item.sourceId !== sourceId || item.revision !== catalog.viewRevision)
        throw new ConflictException('Pivot 지표·열 정의가 변경되었습니다. 다시 추가해 주세요.');
      const state = validateExploreViewState(item.state, catalog);
      if (state.mode !== 'pivot') throw new ConflictException('잘못된 Pivot 설정입니다.');
      return {
        ...item,
        state,
        sourceRevision: catalog.sourceRevision,
        dimensions: catalog.dimensions,
      };
    });
    return { status: 'SUCCESS', data };
  }
  async add(id: unknown, actor: number, body: any) {
    const dashboardId = this.access.id(id);
    await this.access.assert('dashboard', dashboardId, actor);
    if (
      !body ||
      Array.isArray(body) ||
      Object.keys(body).some(k => !['sourceId', 'viewId'].includes(k))
    )
      throw new BadRequestException('Pivot 저장 보기를 선택해 주세요.');
    const sourceId = this.access.id(body.sourceId);
    const view = (await this.views.load(sourceId, body.viewId, actor)).data;
    if (view.state.mode !== 'pivot')
      throw new BadRequestException('Pivot 보기만 추가할 수 있습니다.');
    const item = {
      id: randomUUID(),
      name: view.name,
      sourceId,
      revision: view.revision,
      state: view.state,
    };
    await serializedViewWrite(this.dashboards, async () => {
      await this.access.assert('dashboard', dashboardId, actor);
      await this.access.assert('database', sourceId, actor);
      await this.dashboards.manager.transaction(async manager => {
        const row = await manager.findOne(Dashboard, {
          where: { id: dashboardId },
          ...(manager.connection.options.type === 'mysql'
            ? { lock: { mode: 'pessimistic_write' as const } }
            : {}),
        });
        if (!row || this.source(row) !== sourceId)
          throw new BadRequestException(
            '대시보드와 Pivot의 데이터 소스가 같아야 공통 필터를 연결할 수 있습니다.',
          );
        const catalog = await this.explore.catalog({ sourceId }, actor);
        if (catalog.viewRevision !== item.revision)
          throw new ConflictException('Pivot 정의가 변경되었습니다. 다시 불러와 주세요.');
        validateExploreViewState(item.state, catalog);
        const items = this.items(row);
        if (items.length >= 8) throw new BadRequestException('Pivot은 대시보드별 최대 8개입니다.');
        row.pivotDefinitions = JSON.stringify([...items, item]);
        await manager.save(Dashboard, row);
      });
    });
    return { status: 'SUCCESS', data: item };
  }
  async remove(id: unknown, pivotId: string, actor: number) {
    const dashboardId = this.access.id(id);
    await this.access.assert('dashboard', dashboardId, actor);
    await serializedViewWrite(this.dashboards, async () => {
      await this.access.assert('dashboard', dashboardId, actor);
      await this.dashboards.manager.transaction(async manager => {
        const row = await manager.findOne(Dashboard, {
          where: { id: dashboardId },
          ...(manager.connection.options.type === 'mysql'
            ? { lock: { mode: 'pessimistic_write' as const } }
            : {}),
        });
        const items = this.items(row);
        if (!items.some(item => item.id === pivotId))
          throw new NotFoundException('Pivot을 찾을 수 없습니다.');
        row.pivotDefinitions = JSON.stringify(items.filter(item => item.id !== pivotId));
        await manager.save(Dashboard, row);
      });
    });
    return { status: 'SUCCESS', data: { id: pivotId } };
  }
}
