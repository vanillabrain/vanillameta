import { ConflictException, ForbiddenException } from '@nestjs/common';

/**
 * UC-016: bounded batch block edits. This module stays pure so the strict
 * classifier and the editor service share one contract without a provider or a
 * database dependency.
 *
 * A batch plan is exactly `{intent:'batch', saveRequested:boolean, actions:[...]}`
 * with 2 to 6 actions. Every action is exactly `{editMode, targetPrompt, editPrompt}`.
 * `targetPrompt` must appear verbatim in the original question, so a generated
 * plan can never invent a target block (BR-016-01).
 */
export const MIN_BATCH_ACTIONS = 2;
export const MAX_BATCH_ACTIONS = 6;
export const MAX_BATCH_PROMPT = 2000;

export type BatchBlockAction = {
  editMode: 'content' | 'layout';
  targetPrompt: string;
  editPrompt: string;
};
export type BatchEditPlan = {
  intent: 'batch';
  saveRequested: boolean;
  actions: BatchBlockAction[];
  /**
   * UC-019: set to `true` only when the same question also explicitly asked for
   * publication. The key is omitted otherwise and is never `false`.
   */
  publicationRequested?: true;
};
export type BatchFailureStage = 'target' | 'change' | 'preview';

/**
 * Safe, user-facing text only. Provider and SQL failures never reach the client
 * (BR-016-04); the stage and the block position carry the recoverable detail.
 */
export const BATCH_FAILURE_MESSAGES: Record<BatchFailureStage, string> = {
  target:
    '수정 대상을 확인하지 못했습니다. 2~6개의 서로 다른 블록을 번호나 정확한 제목으로 다시 질문해 주세요.',
  change: '변경을 적용하지 못했습니다. 초안은 유지됩니다. 질문을 수정해 다시 실행해 주세요.',
  preview: '전체 미리보기에 실패했습니다. 초안은 유지됩니다. 질문을 수정해 다시 실행해 주세요.',
};

/** The batch keyset is disjoint from the strict 3-key content/layout/save/clarify shape. */
export function isBatchPlanShape(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join(',') === 'actions,intent,saveRequested'
  );
}

/**
 * Strict batch parsing. Throws a plain `Error` on any shape violation so the
 * classifier rejects the plan instead of degrading to another intent.
 */
export function parseBatchActions(value: unknown, question: string): BatchBlockAction[] {
  if (!Array.isArray(value)) throw new Error('batch-actions');
  if (value.length < MIN_BATCH_ACTIONS || value.length > MAX_BATCH_ACTIONS)
    throw new Error('batch-actions');
  return value.map(entry => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      Object.keys(entry as Record<string, unknown>)
        .sort()
        .join(',') !== 'editMode,editPrompt,targetPrompt'
    )
      throw new Error('batch-action');
    const editMode = (entry as Record<string, unknown>).editMode;
    if (editMode !== 'content' && editMode !== 'layout') throw new Error('batch-action');
    const rawTarget = (entry as Record<string, unknown>).targetPrompt;
    if (typeof rawTarget !== 'string') throw new Error('batch-action');
    const targetPrompt = rawTarget.trim();
    if (!targetPrompt || targetPrompt.length > MAX_BATCH_PROMPT) throw new Error('batch-target');
    if (!question.includes(targetPrompt)) throw new Error('batch-target');
    const rawEdit = (entry as Record<string, unknown>).editPrompt;
    if (typeof rawEdit !== 'string') throw new Error('batch-action');
    const editPrompt = rawEdit.trim();
    if (!editPrompt || editPrompt.length > MAX_BATCH_PROMPT) throw new Error('batch-action');
    return { editMode, targetPrompt, editPrompt };
  });
}

/**
 * UC-014/UC-015 boundaries keep precedence: a 409, a lost ownership check or a
 * cancelled request is never rewritten into a batch failure. The editor service
 * fails the whole batch on every other error.
 */
export function isBatchControlError(error: unknown): boolean {
  if (error instanceof ConflictException || error instanceof ForbiddenException) return true;
  return error instanceof Error && error.message === 'LLM_REQUEST_ABORTED';
}
