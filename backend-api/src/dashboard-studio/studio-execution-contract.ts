import { StudioDocumentV1, StudioOperation } from './studio-contract';
export type StudioStepId =
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
  unsupported?: StudioStepId;
  proposal?: { intent: string; operations: StudioOperation[]; document: StudioDocumentV1 };
};
