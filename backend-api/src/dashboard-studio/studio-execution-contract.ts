import { PublicationMetadata } from './studio-publication-contract';
import { StudioDocumentV1, StudioOperation } from './studio-contract';
export type StudioStepId =
  | 'createProposal'
  | 'inspectSource'
  | 'proposeSemantics'
  | 'preview'
  | 'applyDraft'
  | 'saveDraft'
  | 'publish'
  | 'remix';
export type StudioStepStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'unsupported';
export type StudioExecutionStep = {
  stepId: StudioStepId;
  status: StudioStepStatus;
  resultRef?: string;
  errorCode?: string;
  retryable: boolean;
};
export type StudioExecutionRequest = {
  requestId: string;
  dashboardId: number;
  expectedRevision: string;
  expectedSourceRevision: string;
  document: StudioDocumentV1;
  clientEditVersion: number;
  selectedBlockId?: string;
  prompt: string;
};
export type StudioExecutionState = {
  request: Omit<StudioExecutionRequest, 'prompt'>;
  steps: StudioExecutionStep[];
  save: boolean;
  saveOnly: boolean;
  publish?: boolean;
  publicationResult?: PublicationMetadata;
  /** Owner publication observed before the first attempt; null means none existed. */
  publicationBasis?: { token: string; version: number } | null;
  remix?: boolean;
  remixToken?: string;
  remixResult?: { token: string; version: number };
  /**
   * Claim for the single private clone of this execution. It records the exact remix request
   * identity and digest only: no mapping values, rows, credential or prompt history.
   */
  remixSave?: StudioRemixSaveClaim;
  /** Durable receipt of the private clone for this execution. */
  remixSaveResult?: StudioRemixSaveResult;
  create?: boolean;
  creationResult?: { proposalId: string; sourceId: number; sourceRevision: string };
  /** Last completed answer receipt; no prompt, SQL or preview payload. */
  creationClarification?: { requestId: string; payloadHash: string };
  creationSaveResult?: { dashboardId: number; sourceId: number; revision: string };
  unsupported?: StudioStepId;
  proposal?: { intent: string; operations: StudioOperation[]; document: StudioDocumentV1 };
};
export type StudioRemixSaveClaim = {
  /** Deterministic remix request ID derived from the run ID, so a retry can never duplicate a clone. */
  requestId: string;
  payloadHash: string;
  targetSourceId: number;
  expectedSourceRevision: string;
  expectedVersion: number;
};
export type StudioRemixSaveResult = {
  dashboardId: number;
  sourceId: number;
  revision: string;
  version: number;
};
