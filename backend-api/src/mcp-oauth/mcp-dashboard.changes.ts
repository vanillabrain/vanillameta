import { StudioDocumentV1 } from '../dashboard-studio/studio-contract';
import { applyStudioOperation } from '../dashboard-studio/studio-operations';
import { DashboardToolException } from './mcp-dashboard.errors';

export const MAX_CHANGES = 20;
const MAX_CHANGES_BYTES = 64 * 1024;

/**
 * The edits a connection may make to a saved dashboard, each the Studio operation of the same name:
 * what a person does with a dashboard's text, layout and filters, and removing a block. Anything that
 * would change what a block calculates (its metric, dimensions or kind), add a block, or touch the
 * business conditions is not in this list. Each type maps to the keys it may carry.
 */
const ALLOWED: Record<string, readonly string[]> = {
  renameDashboard: ['type', 'title'],
  updateBlock: ['type', 'blockId', 'patch'],
  moveBlock: ['type', 'blockId', 'breakpoint', 'x', 'y'],
  resizeBlock: ['type', 'blockId', 'breakpoint', 'w', 'h'],
  removeBlock: ['type', 'blockId'],
  setFilters: ['type', 'filters'],
  setDateRange: ['type', 'dateRange'],
};
/** An update changes a block's text and display only, never its calculation. */
const PATCH_KEYS = ['title', 'description', 'display'];

const invalid = () => new DashboardToolException('INVALID', 'INVALID_INPUT');

/**
 * The change list as the request named it: unknown types are UNSUPPORTED_CHANGE (a rule), a bad
 * shape is INVALID_INPUT (a mistake). The result is what the request's identity is hashed from, so
 * it keeps only the allowed keys.
 */
export function cleanChanges(input: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_CHANGES) throw invalid();
  if (JSON.stringify(input).length > MAX_CHANGES_BYTES) throw invalid();
  return input.map(change => {
    if (typeof change !== 'object' || change === null || Array.isArray(change)) throw invalid();
    const type = (change as { type?: unknown }).type;
    if (typeof type !== 'string') throw invalid();
    const keys = Object.prototype.hasOwnProperty.call(ALLOWED, type) ? ALLOWED[type] : undefined;
    if (!keys) throw new DashboardToolException('INVALID', 'UNSUPPORTED_CHANGE');
    const record = change as Record<string, unknown>;
    if (Object.keys(record).some(key => !keys.includes(key))) throw invalid();
    if (type === 'updateBlock') {
      const patch = record.patch;
      if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) throw invalid();
      const patchKeys = Object.keys(patch);
      if (!patchKeys.length) throw invalid();
      if (patchKeys.some(key => !PATCH_KEYS.includes(key)))
        throw new DashboardToolException('INVALID', 'UNSUPPORTED_CHANGE');
    }
    return JSON.parse(JSON.stringify(record));
  });
}

/** Applies the changes in order; each is validated by the same code a person's edit goes through. */
export function applyChanges(
  document: StudioDocumentV1,
  changes: Array<Record<string, unknown>>,
): StudioDocumentV1 {
  let next = document;
  try {
    for (const change of changes) next = applyStudioOperation(next, change);
  } catch {
    // A rejected operation names a block that does not exist or a value the dashboard cannot hold.
    throw invalid();
  }
  // A dashboard with no block is a removal, which has its own tool.
  if (!next.blocks.length) throw invalid();
  return next;
}
