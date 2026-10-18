/** Owner-only Studio protocol. Raw SQL, rows and credentials live outside this history document. */
export const STUDIO_COLUMNS = { lg: 12, md: 8, xs: 1 } as const;
export const STUDIO_BREAKPOINTS = ['lg', 'md', 'xs'] as const;
export type StudioBreakpoint = (typeof STUDIO_BREAKPOINTS)[number];
export type StudioBlockKind = 'BOARD_NUMERIC' | 'CHART_COLUMN' | 'CHART_BAR' | 'CHART_LINE';
export type StudioMeasureRef = { id: number; definitionVersion: string };
export type StudioDimensionRef = { key: string; sourceId: number; schemaVersion: string };
export type StudioDisplay = {
  presentation?: 'visual' | 'table' | 'summary';
  timeGrain?: 'auto' | 'day' | 'week' | 'month';
  decimalPlaces?: number;
  numberNotation?: 'full' | 'compact';
  prefix?: string;
  suffix?: string;
};
export type StudioBlock = {
  id: string;
  kind: StudioBlockKind;
  definitionKey: string;
  title: string;
  description: string;
  measureRefs: StudioMeasureRef[];
  dimensionRefs: StudioDimensionRef[];
  display: StudioDisplay;
};
export type StudioLayoutItem = { id: string; x: number; y: number; w: number; h: number };
/** One categorical scope column. Values keep their JSON type, so 1, "1", true and null stay distinct. */
export type StudioFilterValue = string | number | boolean | null;
export type StudioFilter = { column: string; values: StudioFilterValue[] };
export const STUDIO_FILTER_LIMITS = { columns: 5, values: 50, columnLength: 128, textLength: 2000 } as const;
export const STUDIO_DATE_LIMITS = { columnLength: 128 } as const;
/**
 * Common dashboard period. Without a precision the bounds are UTC calendar days (YYYY-MM-DD); with
 * precision 'timestamp' they are server-proven UTC instants and the end is exclusive.
 */
export type StudioDateRange = {
  column: string;
  start: string;
  end: string;
  precision?: 'timestamp';
  timeZone?: string;
};
export type StudioDocumentV1 = {
  schemaVersion: 1;
  dashboardId?: number;
  revision?: string;
  title: string;
  sourceId: number;
  /** Common dashboard scope. Absent means no filters; an empty array removes the optional property. */
  filters?: StudioFilter[];
  /** Common period. Absent means no period scope; a null operation removes the optional property. */
  dateRange?: StudioDateRange;
  blocks: StudioBlock[];
  layouts: Record<StudioBreakpoint, StudioLayoutItem[]>;
};
export type StudioOperation =
  | { type: 'addBlock'; block: StudioBlock }
  | { type: 'duplicateBlock'; blockId: string; newId: string }
  | { type: 'removeBlock'; blockId: string }
  | {
      type: 'updateBlock';
      blockId: string;
      patch: Partial<
        Pick<StudioBlock, 'title' | 'description' | 'definitionKey' | 'measureRefs' | 'dimensionRefs' | 'display'>
      >;
    }
  | { type: 'moveBlock'; blockId: string; breakpoint: StudioBreakpoint; x: number; y: number }
  | { type: 'resizeBlock'; blockId: string; breakpoint: StudioBreakpoint; w: number; h: number }
  | { type: 'renameDashboard'; title: string }
  | { type: 'setFilters'; filters: StudioFilter[] }
  | { type: 'setDateRange'; dateRange: StudioDateRange | null };
export type StudioState = {
  present: StudioDocumentV1;
  past: StudioDocumentV1[];
  future: StudioDocumentV1[];
  selectedBlockId: string | null;
  activeBreakpoint: StudioBreakpoint;
  panel: 'ai' | 'settings' | null;
  saveState: 'clean' | 'dirty';
  savedBaseline: StudioDocumentV1;
  serverRevision?: string;
  pendingSave: { requestId: string; document: StudioDocumentV1; baseRevision?: string } | null;
};
export type StudioAction =
  | { type: 'apply'; operation: StudioOperation }
  | { type: 'applyBatch'; operations: StudioOperation[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; blockId: string | null }
  | { type: 'breakpoint'; breakpoint: StudioBreakpoint }
  | { type: 'panel'; panel: StudioState['panel'] }
  | { type: 'saveStarted'; requestId: string }
  | { type: 'saveFailed'; requestId: string }
  | { type: 'saved'; requestId: string; revision: string; idMap: Record<string, string> };
export const isTemporaryStudioId = (id: unknown): id is string =>
  typeof id === 'string' && /^new:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const isStudioId = (id: unknown): id is string =>
  isTemporaryStudioId(id) || (typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id));
