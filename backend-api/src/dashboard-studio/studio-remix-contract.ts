import {
  StudioBlockKind,
  StudioConditions,
  StudioDateRange,
  StudioDisplay,
  StudioDocumentV1,
  StudioFilter,
} from './studio-contract';
export type RemixRequiredField = { name: string; type: string; blockIds: string[] };
export type RemixBlock = {
  id: string;
  title: string;
  kind: StudioBlockKind;
  supported: boolean;
  reason?: string;
};
export type RemixTemplate = {
  schemaVersion: 1;
  conditions?: StudioConditions;
  title: string;
  filters?: StudioFilter[];
  dateRange?: StudioDateRange;
  requiredFields: RemixRequiredField[];
  blocks: Array<
    RemixBlock & {
      description: string;
      display: StudioDisplay;
      metric?: {
        label: string;
        aggregation: string;
        column: string;
        denominatorColumn?: string;
        weightColumn?: string;
        scale?: number;
        unit: string;
        decimalPlaces: number;
        numberNotation: string;
      };
      dimension?: { column: string };
    }
  >;
  layouts: StudioDocumentV1['layouts'];
};
export type RemixPreviewRequest = {
  expectedLifecycleRevision: string;
  targetSourceId: number;
  mapping: Record<string, string>;
  excludedBlockIds?: string[];
  expectedVersion?: number;
};
export type RemixRequest = RemixPreviewRequest & {
  requestId: string;
  expectedVersion: number;
  expectedSourceRevision: string;
};
export type RemixRequirements = {
  lifecycleRevision: string;
  conditions?: StudioConditions;
  token: string;
  version: number;
  title: string;
  filters: StudioFilter[];
  dateRange?: StudioDateRange;
  requiredFields: RemixRequiredField[];
  blocks: RemixBlock[];
};
export type RemixField = {
  sourceColumn: string;
  sourceType: string;
  targetColumn?: string;
  status: 'mapped' | 'missing' | 'incompatible' | 'ambiguous';
  candidates: string[];
};
export type RemixPreview = RemixRequirements & {
  targetSourceId: number;
  sourceRevision: string;
  profile: {
    sourceId: number;
    rowCount: string;
    name?: string;
    dataVersion: string;
    columns: Array<{ name: string; type: string; numeric: boolean; temporal: boolean }>;
  };
  mapping: Record<string, string>;
  fields: RemixField[];
  mappedConditions?: StudioConditions;
  unmappedConditions: string[];
  mappedFilters: StudioFilter[];
  unmappedFilters: string[];
  mappedDateRange?: StudioDateRange;
  unmappedDateRange?: string;
  unmappedBlocks: Array<{
    blockId: string;
    title: string;
    reason: string;
    missingFields: string[];
  }>;
  preview?: { widgets: any[] };
};
