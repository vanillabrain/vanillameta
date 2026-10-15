import isEqual from 'lodash/isEqual';
import { validDraft, validPreview } from './dashboardPreview';

/** Pair the server's canonical proposal and digest with exactly the preview being saved. */
export const validSemanticCandidate = (value: any, sourceId: number) =>
  value?.proposal?.schemaVersion === 1 &&
  value.proposal.sourceId === sourceId &&
  typeof value.proposal.sourceRevision === 'string' &&
  typeof value.previewDigest === 'string' &&
  /^[a-f0-9]{64}$/.test(value.previewDigest) &&
  Array.isArray(value.proposal.blocks) &&
  value.proposal.blocks.length > 0 &&
  value.proposal.blocks.length <= 6 &&
  Array.isArray(value.plan?.measures) &&
  value.plan.measures.length > 0 &&
  value.plan.measures.every(
    m =>
      ['create', 'reuse'].includes(m?.action) &&
      typeof m.identity === 'string' &&
      typeof m.key === 'string' &&
      typeof m.definition?.label === 'string' &&
      typeof m.definition.aggregation === 'string' &&
      typeof m.definition.column === 'string' &&
      (m.action !== 'reuse' || (Number.isSafeInteger(m.metricId) && m.metricId > 0)),
  ) &&
  Array.isArray(value.plan?.dimensions) &&
  value.plan.dimensions.every(
    d => typeof d?.key === 'string' && typeof d.label === 'string' && typeof d.type === 'string',
  ) &&
  validDraft(value.draft) &&
  value.draft.databaseId === sourceId &&
  value.draft.widgets.length === value.proposal.blocks.length;

export const validSemanticPreview = (value: any, sourceId: number) =>
  validSemanticCandidate(value, sourceId) &&
  validPreview(value.preview) &&
  isEqual(value.preview.draft.widgets, value.draft.widgets) &&
  value.preview.draft.databaseId === sourceId;
