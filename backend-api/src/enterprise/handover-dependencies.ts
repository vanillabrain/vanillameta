import { SUPPORTED_CLIENTS } from 'knex/lib/constants';
import { EntityManager } from 'typeorm';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { StudioState } from '../dashboard-studio/entities/studio-state.entity';
import { DashboardWidget } from '../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Widget } from '../widget/entities/widget.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { TableQuery } from '../widget/tabel-query/entity/table-query.entity';
import { Database } from '../database/entities/database.entity';

const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0 && Number(value) < 2147483647;
const object = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Declared outward edges only. Never parses SQL or opens source files/connections. */
export async function declaredHandoverSources(manager: EntityManager, dashboardId: number) {
  const sourceIds = new Set<number>();
  let unresolved = false;
  const add = (value: unknown) => {
    if (positive(value)) sourceIds.add(value);
    else unresolved = true;
  };
  const read = (text: string, consume: (value: any) => void) => {
    try {
      consume(JSON.parse(text));
    } catch {
      unresolved = true;
    }
  };
  const board = await manager.findOneBy(Dashboard, { id: dashboardId });
  if (!board) return { sourceIds, unresolved: true };
  for (const [text, key] of [
    [board.analysisDefinition, 'databaseId'],
    [board.structuredDefinition, 'sourceId'],
  ] as const) {
    if (text === null || text === undefined || text === '') continue;
    read(text, value => {
      if (!object(value)) unresolved = true;
      else add(value[key]);
    });
  }
  if (
    board.pivotDefinitions !== null &&
    board.pivotDefinitions !== undefined &&
    board.pivotDefinitions !== ''
  ) {
    read(board.pivotDefinitions, value => {
      if (!Array.isArray(value)) {
        unresolved = true;
        return;
      }
      for (const pivot of value) {
        if (!object(pivot)) unresolved = true;
        else add(pivot.sourceId);
      }
    });
  }
  const studio = await manager.findOneBy(StudioState, { dashboardId });
  if (studio)
    read(studio.document, value => {
      if (!object(value) || !object(value.document)) unresolved = true;
      else add(value.document.sourceId);
    });
  for (const link of await manager.find(DashboardWidget, {
    where: { dashboardId },
    select: { widgetId: true },
  })) {
    const widget = await manager.findOne(Widget, {
      where: { id: link.widgetId },
      select: { id: true, datasetType: true, datasetId: true },
    });
    if (!widget || !positive(widget.datasetId)) {
      unresolved = true;
      continue;
    }
    if (widget.datasetType === 'DATASET') {
      const dataset = await manager.findOne(Dataset, {
        where: { id: widget.datasetId },
        select: { id: true, databaseId: true },
      });
      add(dataset?.databaseId);
    } else if (widget.datasetType === 'TABLE') {
      const table = await manager.findOne(TableQuery, {
        where: { id: widget.datasetId },
        select: { id: true, databaseId: true },
      });
      add(table?.databaseId);
    } else unresolved = true;
  }
  return { sourceIds, unresolved };
}

export async function handoverSourceCoverage(
  manager: EntityManager,
  ownerId: number,
  selected: Set<number>,
  dashboardId: number,
) {
  const { sourceIds, unresolved } = await declaredHandoverSources(manager, dashboardId);
  let invalid = unresolved,
    selectedSources = 0,
    missingOwnedSources = 0,
    otherSources = 0;
  for (const id of sourceIds) {
    const source = await manager.findOne(Database, {
      where: { id },
      select: { id: true, ownerId: true, catalogActive: true },
    });
    if (!source) {
      invalid = true;
      continue;
    }
    if (!source.catalogActive) invalid = true;
    if (source.ownerId !== ownerId) otherSources++;
    else if (source.catalogActive) {
      if (selected.has(id)) selectedSources++;
      else missingOwnedSources++;
    }
  }
  return {
    dependencyStatus: invalid
      ? ('unresolved' as const)
      : missingOwnedSources || otherSources
      ? ('missing' as const)
      : ('covered' as const),
    requiredSources: sourceIds.size,
    selectedSources,
    missingOwnedSources,
    otherSources,
  };
}

export function handoverStorage(engine: string) {
  const normalized = String(engine).trim().toLowerCase();
  if (['duckdb', 'sqlite', 'sqlite3', 'better-sqlite3'].includes(normalized))
    return 'file_review_required' as const;
  // Reuse the installed connection driver's declared aliases; do not inspect credentials.
  if (
    SUPPORTED_CLIENTS.includes(normalized) ||
    ['bigquery', 'snowflake', 'clickhouse', 'trino', 'databricks'].includes(normalized)
  )
    return 'connection_review_required' as const;
  return 'unresolved' as const;
}
