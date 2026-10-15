import type { DashboardDateRange } from '../ai/dashboard-date-range';

/** Owner-only Studio protocol. Raw SQL, rows and credentials live outside this history document. */
export const STUDIO_COLUMNS = { lg: 12, md: 8, xs: 1 } as const;
export const STUDIO_BREAKPOINTS = ['lg', 'md', 'xs'] as const;
export type StudioBreakpoint = (typeof STUDIO_BREAKPOINTS)[number];
export type StudioBlockKind = 'BOARD_NUMERIC' | 'CHART_COLUMN' | 'CHART_BAR' | 'CHART_LINE';
export type StudioMeasureRef = { id: number; definitionVersion: string };
export type StudioDimensionRef = { key: string; sourceId: number; schemaVersion: string };
export type StudioDisplay = {
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
export type StudioFilter = { column: string; values: Array<string | number | boolean | null> };
/** Saved common date range reuses the shared validated contract; the alias keeps Studio vocabulary local. */
export type StudioDateRange = DashboardDateRange;
export type StudioDocumentV1 = {
  filters?: StudioFilter[];
  dateRange?: StudioDateRange;
  schemaVersion: 1;
  dashboardId?: number;
  revision?: string;
  title: string;
  sourceId: number;
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
        Pick<
          StudioBlock,
          'title' | 'description' | 'definitionKey' | 'measureRefs' | 'dimensionRefs' | 'display'
        >
      >;
    }
  | { type: 'moveBlock'; blockId: string; breakpoint: StudioBreakpoint; x: number; y: number }
  | { type: 'resizeBlock'; blockId: string; breakpoint: StudioBreakpoint; w: number; h: number }
  | { type: 'renameDashboard'; title: string }
  | { type: 'setFilters'; filters: StudioFilter[] }
  | { type: 'setDateRange'; dateRange: StudioDateRange | null };
export const isTemporaryStudioId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^new:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const isStudioId = (id: unknown): id is string =>
  isTemporaryStudioId(id) || (typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id));
