import {
  StudioBlockKind,
  StudioDateRange,
  StudioDisplay,
  StudioDocumentV1,
  StudioFilter,
} from './studio-contract';
export type PublicationMetadata = {
  token: string;
  version: number;
  visibility: 'private' | 'link';
  allowRemix: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  asOf: string;
  dataVersion: string;
  dashboardId: number;
};
export type PublicationSnapshot = {
  conditionsApplied?: true;
  title: string;
  periodLabel: string;
  filters: StudioFilter[];
  dateRange?: StudioDateRange;
  blocks: Array<{
    id: string;
    title: string;
    description: string;
    kind: StudioBlockKind;
    display: StudioDisplay;
    valueField: string;
    categoryField?: string;
    fields: Array<{ columnName: string; columnType: string }>;
    datas: Array<Record<string, string | number | boolean | null>>;
    trend?: {
      grain: string;
      timeZone?: string;
      points: Array<{ time: string; value: string | number | null }>;
    };
  }>;
  layouts: StudioDocumentV1['layouts'];
};
