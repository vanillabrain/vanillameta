import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { dashboardRevision } from './dashboard-revision';
import { SourceAccessService } from '../ownership/source-access.service';
import { serializedViewWrite } from './view-write-queue';
import { PersonalView } from './entities/personal-view.entity';
import { resolveViewDates, validatePersonalViewState } from './personal-view-state';

@Injectable()
export class PersonalViewService {
  constructor(
    @InjectRepository(PersonalView) private readonly views: Repository<PersonalView>,
    private readonly access: SourceAccessService,
  ) {}
  private publicView(row: PersonalView) {
    return {
      id: row.id,
      name: row.name,
      revision: row.revision,
      state: validatePersonalViewState(JSON.parse(row.state)),
      createdAt: row.createdAt,
    };
  }
  private success(data: any) {
    return { status: 'SUCCESS', data };
  }
  private write<T>(operation: () => Promise<T>): Promise<T> {
    return serializedViewWrite(this.views, operation);
  }

  private async assertRevision(
    dashboardId: number,
    revision: string,
    manager: EntityManager = this.views.manager,
    lock = false,
  ) {
    const current = await manager.findOne(Dashboard, {
      where: { id: dashboardId },
      ...(lock && manager.connection.options.type === 'mysql'
        ? { lock: { mode: 'pessimistic_write' as const } }
        : {}),
    });
    if (
      !current ||
      current.delYn === 'Y' ||
      !/^[a-f0-9]{64}$/.test(revision || '') ||
      dashboardRevision(current) !== revision
    )
      throw new ConflictException(
        '대시보드 정의가 변경되었습니다. 현재 대시보드에서 조건을 확인하고 새 보기로 저장해 주세요.',
      );
  }
  async list(dashboardId: number, userId: number) {
    // UC-051: a personal saved view only reads the dashboard, so an explicit read grant is enough.
    await this.access.dashboard(dashboardId, userId, 'read');
    const rows = await this.views.find({
      where: { dashboardId, userId },
      order: { id: 'DESC' },
      take: 20,
    });
    return this.success(rows.map(row => this.publicView(row)));
  }
  async create(dashboardId: number, userId: number, body: any) {
    await this.access.dashboard(dashboardId, userId, 'read');
    if (
      !body ||
      Object.keys(body).some(key => !['name', 'state', 'revision'].includes(key)) ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.trim().length > 80
    )
      throw new BadRequestException('보기 이름은 1~80자로 입력해 주세요.');
    const state = validatePersonalViewState(body.state);
    const row = await this.write(async () => {
      await this.access.dashboard(dashboardId, userId, 'read');
      return this.views.manager.transaction(async manager => {
        await this.access.dashboard(dashboardId, userId, 'read', manager);
        // Serialize MySQL admission on the existing dashboard row across server instances.
        await this.assertRevision(dashboardId, body.revision, manager, true);
        const repo = manager.getRepository(PersonalView);
        if ((await repo.count({ where: { dashboardId, userId } })) >= 20)
          throw new BadRequestException('개인 보기는 대시보드별 최대 20개까지 저장할 수 있습니다.');
        return repo.save(
          repo.create({
            dashboardId,
            userId,
            name: body.name.trim(),
            revision: body.revision,
            state: JSON.stringify(state),
          }),
        );
      });
    });
    return this.success(this.publicView(row));
  }
  async load(dashboardId: number, viewId: number, userId: number) {
    await this.access.dashboard(dashboardId, userId, 'read');
    const row = await this.views.findOne({
      where: { id: this.access.id(viewId), dashboardId, userId },
    });
    if (!row) throw new NotFoundException('저장 보기를 찾을 수 없습니다.');
    await this.assertRevision(dashboardId, row.revision);
    const view = this.publicView(row);
    return this.success({ ...view, resolvedDateRange: resolveViewDates(view.state) });
  }
  async remove(dashboardId: number, viewId: number, userId: number) {
    await this.access.dashboard(dashboardId, userId, 'read');
    const result = await this.write(async () => {
      await this.access.dashboard(dashboardId, userId, 'read');
      return this.views.delete({ id: this.access.id(viewId), dashboardId, userId });
    });
    if (!result.affected) throw new NotFoundException('저장 보기를 찾을 수 없습니다.');
    return this.success({ id: viewId });
  }
}
