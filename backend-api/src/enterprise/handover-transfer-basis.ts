import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Component } from '../component/entities/component.entity';
import { Database } from '../database/entities/database.entity';
import { Metric } from '../metric/entities/metric.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { StudioExecution } from '../dashboard-studio/entities/studio-execution.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { BiDashboardPolicy } from '../bi/governance.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from './entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { declaredHandoverSources } from './handover-dependencies';
import { dashboardRevision } from '../dashboard/dashboard-revision';
import { sourceQuery, validateDraft, widgetOptions } from '../ai/dashboard-draft';
import { renderValidatedQueryBindings } from '../common/validated-query-bindings';
import { validateStudioDocument } from '../dashboard-studio/studio-document';
import { metricLinkItems } from '../ai/metric-analysis-links';

export function transferCanonical(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(transferCanonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(k => [k, transferCanonical(value[k])]),
    );
  return value;
}
export const transferHash = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(transferCanonical(value)))
    .digest('hex');
const positive = (v: any) => Number.isSafeInteger(v) && v > 0 && v < 2147483647;
const check = (v: unknown) => {
  if (!v) throw new Error('unsupported');
};
const parse = (s: string) => JSON.parse(s);

/** Metadata only. Caller fences Dashboard parents before collecting, then ALL declared Sources. */
export async function transferSourceIds(manager: EntityManager, ids: number[]) {
  const result = new Set<number>();
  for (const id of ids)
    for (const source of (await declaredHandoverSources(manager, id)).sourceIds) result.add(source);
  return [...result].sort((a, b) => a - b);
}

/** No source SQL execution, private file reads, or inference from free text. */
export async function inspectTransfer(
  manager: EntityManager,
  manifest: any[],
  recipient: number,
  lockChildren = false,
) {
  // Parent order is already User/intent/final/Dashboard/Source. Fence canonical children
  // with current reads so raw DELETE/UPDATE cannot invalidate the graph before commit.
  // Read-only review deliberately never requests row locks.
  if (lockChildren && ['mysql', 'mariadb'].includes(manager.connection.options.type)) {
    if (!manager.queryRunner?.isTransactionActive)
      throw new Error('Transfer child locks require a transaction');
    const widgetIds = new Set<number>();
    for (const asset of manifest.filter(a => a.kind === 'dashboard')) {
      const links = await manager.find(DashboardWidget, { where: { dashboardId: asset.id } });
      for (const link of links) widgetIds.add(link.widgetId);
    }
    const datasetIds = new Set<number>();
    for (const id of [...widgetIds].sort((a, b) => a - b)) {
      const widget = await manager.findOne(Widget, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (widget?.datasetType === 'DATASET' && positive(widget.datasetId))
        datasetIds.add(widget.datasetId);
    }
    for (const id of [...datasetIds].sort((a, b) => a - b))
      await manager.findOne(Dataset, { where: { id }, lock: { mode: 'pessimistic_write' } });
  }
  const blockers = new Set<string>();
  if (manifest.some(a => a.kind === 'source')) blockers.add('source_transfer_deferred');
  const boards = [];
  for (const asset of manifest.filter(a => a.kind === 'dashboard').sort((a, b) => a.id - b.id)) {
    const dashboard = await manager.findOneBy(Dashboard, { id: asset.id });
    const mappings = await manager.find(UserMapping, {
      where: { dashboardId: asset.id },
      order: { id: 'ASC' },
    });
    const studio = await manager.findOneBy(StudioState, { dashboardId: asset.id });
    const refs = await declaredHandoverSources(manager, asset.id);
    if (refs.unresolved) blockers.add('unsupported_definition');
    const sources = [],
      metrics = [];
    for (const id of [...refs.sourceIds].sort((a, b) => a - b)) {
      const source = await manager.findOneBy(Database, { id });
      if (!source || !source.catalogActive || source.ownerId !== recipient)
        blockers.add('recipient_source_ownership_required');
      sources.push(source);
      metrics.push(
        ...(await manager.find(Metric, { where: { databaseId: id }, order: { id: 'ASC' } })),
      );
    }
    const policies = await manager.find(BiDashboardPolicy, {
      where: { dashboardId: asset.id },
      order: { id: 'ASC' },
    });
    if (dashboard.governed || policies.length) blockers.add('governed_dashboard');
    if (
      !Number.isSafeInteger(dashboard.assetVersion) ||
      dashboard.assetVersion < 0 ||
      dashboard.assetVersion >= 2147483647
    )
      blockers.add('asset_version_limit');
    const share =
      dashboard.shareId == null
        ? null
        : await manager.findOneBy(DashboardShare, { id: dashboard.shareId });
    const shareUsers =
      dashboard.shareId == null
        ? []
        : await manager.find(Dashboard, {
            where: { shareId: dashboard.shareId },
            select: { id: true },
            order: { id: 'ASC' },
          });
    const grants = await manager.find(EnterpriseResourceGrant, {
      where: { resourceKind: 'dashboard', resourceId: asset.id },
      order: { recipientId: 'ASC' },
    });
    const groupGrants = await manager.find(EnterpriseGroupGrant, {
      where: { resourceKind: 'dashboard', resourceId: asset.id },
      order: { groupId: 'ASC' },
    });
    const deliveries = await manager.find(EnterpriseDashboardDelivery, {
      where: { dashboardId: asset.id },
      order: { ownerId: 'ASC', organizationId: 'ASC', recipientId: 'ASC' },
    });
    const groupDeliveries = await manager.find(EnterpriseGroupDelivery, {
      where: { dashboardId: asset.id },
      order: { ownerId: 'ASC', organizationId: 'ASC', groupId: 'ASC' },
    });
    const publication = await manager.findOneBy(DashboardPublication, { dashboardId: asset.id });
    const studioPublications = await manager.find(StudioPublication, {
      where: { dashboardId: asset.id },
      order: { token: 'ASC' },
    });
    if (
      (dashboard.shareId != null &&
        (!share || share.shareYn !== 'N' || share.allowReuse || shareUsers.length !== 1)) ||
      [...grants, ...groupGrants].some(g => g.read || g.edit || g.publish || g.export) ||
      [...deliveries, ...groupDeliveries].some(d => d.active || d.allowCopy) ||
      publication?.active ||
      studioPublications.some(p => !p.revokedAt)
    )
      blockers.add('shared_dashboard');
    const executions = await manager.find(StudioExecution, {
      where: { dashboardId: asset.id },
      order: { runId: 'ASC' },
    });
    if (executions.some(e => !['succeeded', 'unsupported', 'cancelled'].includes(e.status)))
      blockers.add('running_work');
    // Exports are source-owner bound. No dashboard FK exists and source ownership never moves.
    const links = await manager.find(DashboardWidget, {
      where: { dashboardId: asset.id },
      order: { id: 'ASC' },
    });
    const widgetRows = [];
    try {
      check(dashboard.templateId == null);
      const draft = dashboard.analysisDefinition
        ? validateDraft(parse(dashboard.analysisDefinition))
        : null;
      if (!draft) {
        check(
          dashboard.layout == null ||
            (Array.isArray(parse(dashboard.layout)) && parse(dashboard.layout).length === 0),
        );
        check(
          !links.length &&
            !studio &&
            !dashboard.structuredDefinition &&
            (!dashboard.pivotDefinitions || parse(dashboard.pivotDefinitions).length === 0),
        );
      } else {
        check([...refs.sourceIds].every(id => id === draft.databaseId));
        const raw = parse(dashboard.analysisDefinition);
        // First bounded implementation: canonical scope-free AI/Studio materialization only.
        check(!raw.widgets.some(w => w.timeGrain && w.timeGrain !== 'auto'));
        const snapshot = dashboard.structuredDefinition
          ? parse(dashboard.structuredDefinition)
          : null;
        if (snapshot) {
          check(snapshot.sourceId === draft.databaseId);
          check(!snapshot.studioFilters && !snapshot.studioDateRange && !snapshot.studioConditions);
          const items = metricLinkItems(snapshot, draft);
          check(items.length === draft.widgets.length);
          const visit = (id: number, version: number, definition: any, depth = 0) => {
            check(
              depth <= 1 &&
                positive(id) &&
                positive(version) &&
                definition?.schemaVersion === 1 &&
                definition.sourceId === draft.databaseId &&
                definition.definitionVersion === version,
            );
            const metric = metrics.find(
              m => m.id === id && m.databaseId === draft.databaseId && m.useYn === 'Y',
            );
            check(metric && transferHash(parse(metric.definition)) === transferHash(definition));
            if (definition.aggregation === 'FORMULA') {
              check(
                Array.isArray(definition.formula?.operands) &&
                  definition.formula.operands.length <= 6,
              );
              for (const operand of definition.formula.operands)
                visit(operand.id, operand.definitionVersion, operand.definition, depth + 1);
            }
          };
          for (const [i, item] of items.entries()) {
            if (!Object.keys(item).filter(k => k !== 'key').length) continue;
            check(!item.key || item.key === draft.widgets[i].blockId);
            check(item.sourceId === draft.databaseId);
            if (item.kind === 'studio-unlinked-legacy') {
              check(Object.keys(item).every(k => ['kind', 'sourceId', 'key'].includes(k)));
              continue;
            }
            visit(item.metricId, item.definitionVersion, item.definition);
          }
        }
        // Pivot saved states require source catalog validation; defer this shape rather than guessing.
        check(!dashboard.pivotDefinitions || parse(dashboard.pivotDefinitions).length === 0);
        if (studio) {
          const document = validateStudioDocument(parse(studio.document).document);
          check(
            document.sourceId === draft.databaseId &&
              (document.dashboardId === undefined || document.dashboardId === dashboard.id),
          );
          check(!document.filters?.length && !document.dateRange && !document.conditions);
          for (const block of document.blocks) {
            check(draft.widgets.some(w => w.blockId === block.definitionKey));
            for (const ref of block.measureRefs)
              check(
                metrics.some(
                  m =>
                    m.id === ref.id &&
                    m.useYn === 'Y' &&
                    String(parse(m.definition)?.definitionVersion) === ref.definitionVersion,
                ),
              );
            for (const ref of block.dimensionRefs) check(ref.sourceId === draft.databaseId);
          }
        }
        if (links.length !== draft.widgets.length) blockers.add('unsupported_widget');
        const layout = parse(dashboard.layout);
        check(
          Array.isArray(layout) &&
            layout.length === links.length &&
            new Set(layout.map(l => l.i)).size === links.length &&
            links.every(l => layout.some(g => g.i === String(l.widgetId))),
        );
        for (const [i, link] of links.entries()) {
          const widget = await manager.findOneBy(Widget, { id: link.widgetId });
          const dataset =
            widget?.datasetType === 'DATASET'
              ? await manager.findOneBy(Dataset, { id: widget.datasetId })
              : null;
          const component = widget
            ? await manager.findOneBy(Component, { id: widget.componentId })
            : null;
          const widgetLinks = await manager.find(DashboardWidget, {
            where: { widgetId: link.widgetId },
            order: { id: 'ASC' },
          });
          const consumers = dataset
            ? await manager.find(Widget, {
                where: { datasetType: widget.datasetType, datasetId: dataset.id },
                select: { id: true },
                order: { id: 'ASC' },
              })
            : [];
          const definition = draft.widgets[i];
          const query =
            definition &&
            sourceQuery(
              definition.sql,
              [],
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              definition.businessBasis ?? draft.businessBasis,
            );
          if (
            !widget ||
            !dataset ||
            !definition ||
            widget.delYn !== 'N' ||
            component?.type !== definition.type ||
            widget.title !== definition.title ||
            widget.description !== definition.description ||
            dataset.databaseId !== draft.databaseId ||
            dataset.title !== definition.title ||
            dataset.query !== renderValidatedQueryBindings(query.sql, query.bindings) ||
            transferHash(parse(widget.option)) !== transferHash(widgetOptions(definition)) ||
            widgetLinks.length !== 1 ||
            consumers.length !== 1
          )
            blockers.add('unsupported_widget');
          widgetRows.push({ link, widget, dataset, component, widgetLinks, consumers });
        }
      }
    } catch {
      blockers.add('unsupported_definition');
    }
    if (studio && studio.legacyRevision !== dashboardRevision(dashboard))
      blockers.add('stale_studio');
    boards.push({
      dashboard,
      mappings,
      studio,
      sources,
      metrics,
      policies,
      share,
      shareUsers,
      grants,
      groupGrants,
      deliveries,
      groupDeliveries,
      publication,
      studioPublications,
      executions,
      links,
      widgetRows,
    });
  }
  return { blockers: [...blockers].sort(), boards, hash: transferHash(boards) };
}
