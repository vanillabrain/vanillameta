import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SourceAccessService } from './source-access.service';
@Injectable()
export class SourceOwnershipGuard implements CanActivate {
  constructor(private readonly access: SourceAccessService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const group = context.getClass().name;
    const handler = context.getHandler().name;
    const body = req.body || {};
    const param = req.params?.id;
    if (req.user?.shareKeyData) {
      if (group !== 'DatabaseController' || handler !== 'findData' || req.method !== 'GET')
        throw new ForbiddenException('share access denied');
      // JWT guard has already checked token expiry/revocation and the exact linked dataset ID.
      const owner = await this.access.sharedDashboard(req.user.shareKeyData.dashboardId);
      await this.access.assert(
        req.query.datasetType === 'DATASET' ? 'dataset' : 'table',
        req.query.datasetId,
        owner,
      );
      return true;
    }
    const actor = this.access.actor(req.user?.accessKeyData?.id);
    if (
      req.method === 'POST' &&
      ['create', 'uploadFile'].includes(handler) &&
      body.id !== undefined
    )
      throw new ForbiddenException('create cannot overwrite an existing resource');
    if (group === 'DatabaseController') {
      if (['create', 'testConnection'].includes(handler)) {
        await this.access.assertWebConnection(body);
        return true;
      }
      if (['findAll', 'findTypeList', 'uploadFile'].includes(handler)) return true;
      if (handler === 'update') await this.access.assertWebConnection(body, param);
      if (handler === 'executeQuery') await this.access.assert('database', body.id, actor);
      else if (handler === 'findData') {
        const q = req.query;
        if (q.datasetId !== undefined)
          await this.access.assert(
            q.datasetType === 'DATASET' ? 'dataset' : 'table',
            q.datasetId,
            actor,
          );
        else await this.access.assert('database', q.databaseId, actor);
      } else if (
        [
          'findOne',
          'findOneInfo',
          'update',
          'remove',
          'fileVersions',
          'replaceFile',
          'restoreFile',
        ].includes(handler)
      )
        await this.access.assert('database', param, actor);
      else throw new ForbiddenException('unsupported data access');
    } else if (['MetricController', 'DatasetController', 'WidgetController'].includes(group)) {
      const kind =
        group === 'MetricController'
          ? 'metric'
          : group === 'DatasetController'
          ? 'dataset'
          : 'widget';
      if (handler === 'findAll') return true;
      if (handler !== 'create') await this.access.assert(kind, param, actor);
      if (body.databaseId !== undefined)
        await this.access.assert('database', body.databaseId, actor);
      if (group === 'MetricController' && handler === 'create')
        await this.access.metricName(body.name, actor);
      if (handler === 'create' && group === 'WidgetController')
        await this.access.assert(
          body.datasetType === 'DATASET' ? 'dataset' : 'database',
          body.datasetType === 'DATASET' ? body.datasetId : body.databaseId,
          actor,
        );
      if (handler === 'create' && group !== 'WidgetController' && body.databaseId === undefined)
        throw new ForbiddenException('source required');
    } else if (group === 'AiController') {
      if (
        [
          'metricChangePreview',
          'metricChangeSave',
          'metricImpact',
          'metricBatchPreview',
          'metricBatchSave',
        ].includes(handler)
      ) {
        await this.access.dashboard(body.dashboardId, actor);
        await this.access.assert('metric', body.metricId, actor);
      } else if (handler === 'dashboardMetrics') {
        await this.access.assert('database', param, actor);
      } else if (handler === 'dashboardDetails') {
        const dashboardId = this.access.id(body.dashboardId);
        await this.access.assert('database', body.draft?.databaseId, actor, 'read');
        await this.access.dashboard(dashboardId, actor, 'read');
      } else if (['dashboardPreview', 'dashboardSave'].includes(handler)) {
        await this.access.assert(
          'database',
          body.draft?.databaseId,
          actor,
          body.dashboardId !== undefined ? 'read' : 'owner',
        );
        if (body.dashboardId !== undefined)
          await this.access.dashboard(body.dashboardId, actor, 'edit');
      } else if (['dashboardDraft', 'dashboardAssistant'].includes(handler)) {
        if (body.databaseId !== undefined)
          await this.access.assert('database', body.databaseId, actor);
        if (body.currentDraft !== undefined)
          await this.access.assert('database', body.currentDraft.databaseId, actor);
        if (body.dashboardId !== undefined) await this.access.dashboard(body.dashboardId, actor);
        if (
          body.databaseId === undefined &&
          body.currentDraft === undefined &&
          body.dashboardId === undefined
        )
          throw new ForbiddenException('source required');
      } else if (['textToSql', 'recommendChart'].includes(handler)) {
        await this.access.assert('database', body.databaseId, actor);
        if (handler === 'recommendChart' && body.datasetId !== undefined)
          await this.access.assert(
            body.datasetType === 'DATASET' ? 'dataset' : 'table',
            body.datasetId,
            actor,
          );
      } else if (['dashboardAnalysis', 'dashboardInsight'].includes(handler))
        await this.access.dashboard(param, actor, 'read');
      else throw new ForbiddenException('unsupported AI data access');
    } else if (group === 'DashboardController') {
      if (handler !== 'create' && handler !== 'findAll')
        await this.access.dashboard(
          param,
          actor,
          ['findOne', 'listViews', 'createView', 'loadView', 'removeView'].includes(handler)
            ? 'read'
            : handler === 'update'
            ? 'edit'
            : 'owner',
        );
      if (body.layout !== undefined) {
        if (!Array.isArray(body.layout)) throw new ForbiddenException('invalid layout');
        for (const item of body.layout)
          await this.access.assert(
            'widget',
            item?.i,
            actor,
            handler === 'update' ? 'read' : 'owner',
          );
      }
    } else if (group === 'TemplateController') {
      if (['findRecommendAll', 'getTemplateDashboardLayout'].includes(handler)) {
        if (!Array.isArray(body.widgets)) throw new ForbiddenException('widgets required');
        for (const id of body.widgets) await this.access.assert('widget', id, actor);
      }
    } else throw new ForbiddenException('unsupported resource access');
    return true;
  }
}
