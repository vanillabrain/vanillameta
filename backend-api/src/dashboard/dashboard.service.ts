import { lockSourceActor } from '../database/source-write-lock';
import { lockWidgetAttachmentParents } from './widget-attachment-lock';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { SourceAccessService } from '../ownership/source-access.service';
import { Widget } from '../widget/entities/widget.entity';
import { Dashboard } from './entities/dashboard.entity';
import { DashboardWidget } from './dashboard-widget/entities/dashboard-widget.entity';
import { DashboardWidgetService } from './dashboard-widget/dashboard-widget.service';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { UserService } from 'src/user/user.service';
import { AuthService } from 'src/auth/auth.service';
import { User } from '../user/entities/user.entity.js';
import { YesNo } from 'src/common/enum/yn.enum';
import { DashboardShare } from 'src/dashboard/entities/dashboard_share.entity';
import { UserMapping } from 'src/user/entities/user-mapping.entity';
import { v4 as uuidv4 } from 'uuid';
import { metadataTransaction } from '../common/metadata-work';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Dashboard)
    private dashboardRepository: Repository<Dashboard>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(DashboardShare)
    private readonly dashboardShareRepository: Repository<DashboardShare>,
    @InjectRepository(UserMapping)
    private userMappingRepository: Repository<UserMapping>,
    private readonly dashboardWidgetService: DashboardWidgetService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    @InjectRepository(Widget) private readonly widgetRepository: Repository<Widget>,
    private readonly access: SourceAccessService,
  ) {}

  async assertOwner(dashboardId: number, userId: number, manager?: EntityManager): Promise<void> {
    if (!Number.isInteger(dashboardId) || dashboardId <= 0) {
      throw new BadRequestException('invalid dashboard id');
    }
    const dashboard = await (manager
      ? manager.getRepository(Dashboard)
      : this.dashboardRepository
    ).findOne({ where: { id: dashboardId } });
    if (!dashboard || dashboard.delYn === YesNo.YES || dashboard.assetActive === false) {
      throw new NotFoundException('dashboard not found');
    }
    if (!Number.isInteger(userId) || userId <= 0)
      throw new ForbiddenException('not dashboard owner');
    const mapping = await (manager
      ? manager.getRepository(UserMapping)
      : this.userMappingRepository
    ).findOne({
      where: { dashboardId, userInfoId: userId },
    });
    if (!mapping) throw new ForbiddenException('not dashboard owner');
  }

  async assertRevocationOwner(id: number, actor: number, manager?: EntityManager): Promise<void> {
    await this.access.dashboardRevocation(id, actor, 'owner', manager);
    // Keep the original mapping-only owner semantics for active legacy share-off.
    const row = await (manager ?? this.dashboardRepository.manager).findOne(Dashboard, {
      where: { id },
    });
    if (row.assetActive !== false) await this.assertOwner(id, actor, manager);
  }

  private rejectLifecycleFields(body: unknown) {
    if (
      body &&
      typeof body === 'object' &&
      ['assetActive', 'assetVersion'].some(key => key in body)
    )
      throw new BadRequestException('Use the dashboard lifecycle action to change asset state.');
  }

  private async validateLayout(layout: unknown): Promise<number[]> {
    if (!Array.isArray(layout)) throw new BadRequestException('layout must be an array');
    const ids: number[] = [];
    for (const item of layout) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new BadRequestException('invalid layout item');
      }
      const id = typeof item.i === 'number' || typeof item.i === 'string' ? Number(item.i) : NaN;
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !Number.isFinite(item.x) ||
        item.x < 0 ||
        !Number.isFinite(item.y) ||
        item.y < 0 ||
        !Number.isFinite(item.w) ||
        item.w <= 0 ||
        !Number.isFinite(item.h) ||
        item.h <= 0 ||
        ids.includes(id)
      ) {
        throw new BadRequestException('invalid layout item');
      }
      ids.push(id);
    }
    if (ids.length) {
      const widgets = await this.widgetRepository.find({ where: { id: In(ids) } });
      const existing = new Set(widgets.map(widget => widget.id));
      if (ids.some(id => !existing.has(id))) throw new BadRequestException('widget not found');
    }
    return ids;
  }

  private attachmentTransaction<T>(run: (manager: EntityManager) => Promise<T>) {
    const manager = this.dashboardRepository.manager;
    return ['mysql', 'mariadb'].includes(manager.connection.options.type)
      ? metadataTransaction(manager, 'READ COMMITTED', run)
      : metadataTransaction(manager, run);
  }

  async create(createDashboardDto: CreateDashboardDto, accessToken: number, epoch = 0) {
    this.rejectLifecycleFields(createDashboardDto);
    const widgetIds = await this.validateLayout(createDashboardDto.layout);
    return this.attachmentTransaction(async manager => {
      await lockSourceActor(manager, accessToken, epoch);
      await lockWidgetAttachmentParents(manager, widgetIds, accessToken);
      for (const widgetId of widgetIds)
        await this.access.assert('widget', widgetId, accessToken, 'owner', manager);
      const share = await manager.save(DashboardShare, { uuid: uuidv4(), shareYn: YesNo.NO });
      const dashboard = await manager.save(Dashboard, {
        assetActive: true,
        assetVersion: 0,
        title: createDashboardDto.title,
        layout: JSON.stringify(createDashboardDto.layout),
        delYn: YesNo.NO,
        shareId: share.id,
      });
      await manager.save(UserMapping, { dashboardId: dashboard.id, userInfoId: accessToken });
      await this.dashboardWidgetService.create({ dashboardId: dashboard.id, widgetIds }, manager);
      return {
        status: ResponseStatus.SUCCESS,
        data: { ...dashboard, layout: JSON.parse(dashboard.layout) },
      };
    });
  }

  /**
   * UC-051: owned dashboards stay first-class; an explicit read grant only adds that dashboard.
   * `readableIds` is already the actor's authorized union from SourceAccessService.
   */
  async findAll(userId: number, readableIds: number[] = []) {
    const findUser = await this.userService.findDashboardId(userId);
    if (!findUser && !readableIds.length) {
      return 'not exist user';
    }
    const findId = [...new Set([...(findUser ?? []).map(el => el['dashboardId']), ...readableIds])];
    if (findId === null) {
      throw new HttpException('not found', HttpStatus.NOT_FOUND);
    }
    const find_all = [];
    for (let i = 0; findId.length > i; i++) {
      const dashboard = await this.dashboardRepository.findOne({
        where: { id: findId[i] },
        order: {
          updatedAt: 'desc',
          title: 'asc',
        },
      });
      if (dashboard && dashboard.delYn !== YesNo.YES && dashboard.assetActive !== false)
        find_all.push(dashboard);
    }
    find_all.forEach(el => {
      el.layout = JSON.parse(el.layout);
      if (!(findUser ?? []).some(mapping => mapping['dashboardId'] === el.id)) delete el.shareId;
    });
    return { status: ResponseStatus.SUCCESS, data: find_all };
  }
  // 기존 dashboard all

  /** UC-051: an explicit read action is authorized by the caller through SourceAccessService. */
  async findOne(id: number, userId: number, action: 'owner' | 'read' = 'owner') {
    if (action === 'owner') await this.assertOwner(id, userId);
    const result = await this.assembleDashboard(id);
    if (action === 'owner') return result;
    // UC-051: never hand the owner's live share uuid/token (an anonymous capability) to a
    // granted reader or editor, including an owner calling through the explicit read path.
    const mapping = await this.userMappingRepository.findOne({
      where: { dashboardId: id, userInfoId: userId },
    });
    return mapping ? result : this.redactAnonymousCapabilities(result);
  }

  /** Anonymous link capabilities stay with the dashboard owner, never with a delegated viewer. */
  private redactAnonymousCapabilities(result: any) {
    if (!result || result.status !== ResponseStatus.SUCCESS || !result.data) return result;
    const data = { ...result.data };
    for (const field of ['shareId', 'uuid', 'shareToken', 'shareYn', 'endDate', 'allowReuse'])
      delete data[field];
    return { ...result, data };
  }

  async findShared(id: number) {
    const result = await this.assembleDashboard(id);
    if (result.status !== ResponseStatus.SUCCESS) return result;
    // The existing live renderer needs only its narrowly scoped share token, never saved SQL/metric links.
    const data = result.data;
    return {
      status: result.status,
      data: Object.fromEntries(
        [
          'id',
          'uuid',
          'title',
          'layout',
          'widgets',
          'updatedAt',
          'createdAt',
          'shareYn',
          'endDate',
          'shareToken',
          'allowReuse',
        ]
          .filter(key => data[key] !== undefined)
          .map(key => [key, data[key]]),
      ),
    };
  }

  private async assembleDashboard(id: number) {
    const find_dashboard = await this.dashboardRepository.findOne({ where: { id: id } });
    if (
      !find_dashboard ||
      find_dashboard.delYn === YesNo.YES ||
      find_dashboard.assetActive === false
    ) {
      return { status: ResponseStatus.ERROR, message: '대시보드가 존재하지 않습니다.' };
    }

    const widgetList = await this.dashboardWidgetService.findWidgets(find_dashboard.id);
    find_dashboard.layout = JSON.parse(find_dashboard.layout);
    const find_share_id = await this.dashboardShareRepository.findOne({
      where: { id: find_dashboard.shareId },
    });
    const return_obj = Object.assign({}, find_share_id, find_dashboard, { widgets: widgetList });
    return {
      status: ResponseStatus.SUCCESS,
      data: return_obj,
    };
  }

  /**
   * UC-051: the legacy raw patch stays owner-only for its default call. An explicit edit grant is
   * additionally rechecked inside one transaction so a revoke between the caller check and this
   * write is rejected, and a grantee may only keep widget ids already linked to this dashboard.
   */
  async update(
    id: number,
    updateDashboardDto: UpdateDashboardDto,
    actor?: number,
    action: 'owner' | 'edit' = 'owner',
  ) {
    this.rejectLifecycleFields(updateDashboardDto);
    const widgetIds =
      updateDashboardDto.layout !== undefined
        ? await this.validateLayout(updateDashboardDto.layout)
        : undefined;
    return this.attachmentTransaction(async manager => {
      const dashboard = await lockWidgetAttachmentParents(manager, widgetIds ?? [], actor, id);
      if (actor !== undefined)
        await this.authorizeGrantedEdit(id, actor, action, widgetIds, manager);
      return this.applyUpdate(id, updateDashboardDto, manager, dashboard);
    });
  }

  /**
   * A grantee must not inject a new widget reference (and therefore another source) into a
   * dashboard it does not own; the owning actor keeps the legacy linking behavior.
   */
  private async authorizeGrantedEdit(
    id: number,
    actor: number,
    action: 'owner' | 'edit',
    widgetIds: number[] | undefined,
    manager: EntityManager,
  ) {
    await this.access.dashboard(id, actor, action, manager);
    if (action === 'owner' || widgetIds === undefined) return;
    const mapping = await manager.findOne(UserMapping, {
      where: { dashboardId: id, userInfoId: actor },
    });
    if (mapping) return;
    const linked = await manager.find(DashboardWidget, { where: { dashboardId: id } });
    const allowed = new Set(linked.map(link => link.widgetId));
    if (widgetIds.some(widgetId => !allowed.has(widgetId)))
      throw new ForbiddenException('이미 연결된 위젯만 배치할 수 있습니다.');
  }

  private async applyUpdate(
    id: number,
    updateDashboardDto: UpdateDashboardDto,
    manager: EntityManager,
    find_dashboard: Dashboard,
  ) {
    const hasLayout = updateDashboardDto.layout !== undefined;
    let widgetIds = hasLayout ? await this.validateLayout(updateDashboardDto.layout) : [];
    // UC-006: grid order is presentation, not analysis widget identity/order.
    if (hasLayout && find_dashboard.analysisDefinition) {
      const links = manager;
      const original = await links.find(DashboardWidget, {
        where: { dashboardId: id },
        order: { id: 'ASC' },
      });
      if (
        original.length === widgetIds.length &&
        original.every(m => widgetIds.includes(m.widgetId))
      )
        widgetIds = original.map(m => m.widgetId);
    }

    const changes: Partial<Dashboard> = {};
    if (updateDashboardDto.title) changes.title = updateDashboardDto.title;
    if (hasLayout) changes.layout = JSON.stringify(updateDashboardDto.layout);

    const saveObjDW = {
      dashboardId: id,
      widgetIds: widgetIds,
    };
    // 업데이트할 데이터
    if (hasLayout) await this.dashboardWidgetService.update(id, saveObjDW, manager);
    // Persist presentation only; a concurrently activated policy must remain sticky.
    if (Object.keys(changes).length) await manager.update(Dashboard, id, changes);
    const updatedDashboard = await manager.findOne(Dashboard, { where: { id } });

    updatedDashboard.layout = JSON.parse(updatedDashboard.layout);
    return { status: ResponseStatus.SUCCESS, data: updatedDashboard };
  }
}
