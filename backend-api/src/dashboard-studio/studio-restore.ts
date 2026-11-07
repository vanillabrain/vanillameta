import { ConflictException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { legacyBlockIds } from '../ai/dashboard-blocks';
import { validateDraft } from '../ai/dashboard-draft';
import { metricLinkItems } from '../ai/metric-analysis-links';
import { StudioBlock, StudioDocumentV1, STUDIO_BREAKPOINTS } from './studio-contract';
import { validateStudioDocument } from './studio-document';
import { studioDigest } from './studio-legacy';
import { isStudioPivot, studioCharts } from './studio-pivot.service';

/**
 * A saved state that cannot be put back as it was: the metrics, columns or data it stood on have
 * moved since. Asking again does not help, so the tool layer reports it as not retryable.
 */
export const restoreStale = (message: string) =>
  new ConflictException({ code: 'RESTORE_STALE', message });

/** A state this version does not restore at all (a limit of the feature, or a row that is damaged). */
export const restoreUnsupported = (message: string) =>
  new ConflictException({ code: 'UNSUPPORTED_CHANGE', message });

/** The columns of a history row that a restore reads. */
export interface RestoreRow {
  dashboardId: number;
  revision: string;
  studioDocument: string;
  analysisDefinition: string | null;
  structuredDefinition: string | null;
}

/** What the current dashboard contributes to a restore: the same values a save starts from. */
export interface RestoreCurrent {
  document: StudioDocumentV1;
  snapshot: unknown;
  analysis: { businessBasis?: unknown };
}

/**
 * Blocks the restore brings back that the dashboard no longer has, with what a save needs to treat
 * them as existing ones: their saved link and their widget template. They are appended to the
 * current dashboard's own lists, so the indexes a save computes stay valid.
 */
export interface RestoreExtras {
  blocks: StudioBlock[];
  items: unknown[];
  widgets: Array<{ blockId?: string } & Record<string, unknown>>;
}

/**
 * Whether a history row can be put back at all: it parses, agrees with itself, carries the analysis a
 * removed block is rebuilt from, and holds no pivot (whose recipe a save does not rebuild). An
 * external AI's write is refused when the state it would replace fails this, so that every AI write
 * stays undoable.
 */
export function assertRestorableRow(dashboardId: number, row: RestoreRow) {
  const whole = () => {
    Logger.warn(
      `Dashboard ${dashboardId}: a history row cannot be restored (revision ${row.revision.slice(
        0,
        8,
      )})`,
      'StudioRestore',
    );
    return restoreUnsupported('이 저장본은 복원할 수 없습니다.');
  };
  let stored: StudioDocumentV1;
  let histDraft: ReturnType<typeof legacyBlockIds>;
  let histSnapshot: any;
  try {
    stored = validateStudioDocument(JSON.parse(row.studioDocument).document);
    // Older dashboards have no saved analysis to rebuild a removed block from.
    if (!row.analysisDefinition) throw new Error();
    histDraft = legacyBlockIds(validateDraft(JSON.parse(row.analysisDefinition)), dashboardId);
    histSnapshot = row.structuredDefinition ? JSON.parse(row.structuredDefinition) : null;
  } catch {
    throw whole();
  }
  const charts = studioCharts(stored);
  const draftIds = histDraft.widgets.map(w => w.blockId);
  if (
    stored.revision !== row.revision ||
    stored.dashboardId !== dashboardId ||
    new Set(draftIds).size !== draftIds.length ||
    draftIds.length !== charts.length ||
    !charts.every(block => draftIds.includes(block.id))
  )
    throw whole();
  const histItems = metricLinkItems(histSnapshot, histDraft);
  if (histSnapshot && histItems.length !== histDraft.widgets.length) throw whole();
  if (stored.blocks.some(isStudioPivot))
    throw restoreUnsupported('Pivot이 포함된 대시보드는 복원할 수 없습니다.');
  return { stored, charts, histDraft, histSnapshot, histItems };
}

/**
 * Works out the document a restore saves and the extras above, from a history row the server read
 * itself. Nothing here comes from the caller; the row is checked for being whole before it is used.
 *
 * A block still on the dashboard (same id and same calculation) keeps its id and gets its saved
 * text, display and place back. A block that is gone is saved as a new block with a temporary id,
 * so the save creates its widget again; its comments, if any, stay attached to the old id.
 */
export function deriveRestore(
  dashboardId: number,
  current: RestoreCurrent,
  row: RestoreRow,
  expectedRevision: string,
): { document: StudioDocumentV1; extras: RestoreExtras } {
  const { stored, charts, histDraft, histSnapshot, histItems } = assertRestorableRow(
    dashboardId,
    row,
  );
  // Pivots keep a recipe the save does not rebuild; a restore does not take them in or out.
  if (current.document.blocks.some(isStudioPivot))
    throw restoreUnsupported('Pivot이 포함된 대시보드는 복원할 수 없습니다.');
  if (!histSnapshot !== !current.snapshot)
    throw restoreStale('저장 이후 대시보드의 저장 형식이 달라졌습니다.');
  if (stored.sourceId !== current.document.sourceId)
    throw restoreStale('저장 이후 데이터 소스가 바뀌었습니다.');
  if (
    studioDigest(stored.businessBasis ?? null) !==
    studioDigest(current.document.businessBasis ?? null)
  )
    throw restoreStale('저장 이후 업무 기준이 바뀌었습니다.');
  // Business conditions are tied to a data file; this version restores neither adding nor dropping them.
  if (studioDigest(stored.conditions ?? null) !== studioDigest(current.document.conditions ?? null))
    throw restoreUnsupported('업무 조건이 달라진 저장본은 복원할 수 없습니다.');

  const now = new Map(current.document.blocks.map(block => [block.id, block]));
  const kept = new Set(
    stored.blocks
      .filter(block => {
        const here = now.get(block.id);
        return here && here.definitionKey === block.definitionKey && here.kind === block.kind;
      })
      .map(block => block.id),
  );
  // Without one block that keeps its identity, a save would hand each new widget the id of a
  // different block by position, and the comments on that id would land on the wrong chart.
  if (charts.length && !charts.some(block => kept.has(block.id)))
    throw restoreUnsupported('남아 있는 차트가 없어 복원하면 차트 연결이 어긋납니다.');

  const idOf = new Map<string, string>();
  for (const block of stored.blocks)
    idOf.set(block.id, kept.has(block.id) ? block.id : `new:${randomUUID()}`);
  const currentKeys = new Set(current.document.blocks.map(block => block.definitionKey));
  const extras: RestoreExtras = { blocks: [], items: [], widgets: [] };
  for (const block of stored.blocks) {
    if (kept.has(block.id) || currentKeys.has(block.definitionKey)) continue;
    const at = histDraft.widgets.findIndex(widget => widget.blockId === block.id);
    extras.blocks.push(block);
    extras.items.push(histSnapshot ? histItems[at] : undefined);
    extras.widgets.push(histDraft.widgets[at] as never);
  }
  const document = validateStudioDocument({
    ...stored,
    dashboardId,
    revision: expectedRevision,
    blocks: stored.blocks.map(block => ({ ...block, id: idOf.get(block.id) })),
    layouts: Object.fromEntries(
      STUDIO_BREAKPOINTS.map(breakpoint => [
        breakpoint,
        stored.layouts[breakpoint].map(item => ({ ...item, id: idOf.get(item.id) })),
      ]),
    ),
  });
  return { document, extras };
}
