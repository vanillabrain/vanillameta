import { studioAssert, studioClone, studioKeys, studioText, validateStudioDocument } from './studioDocument';
import {
  isStudioId,
  isTemporaryStudioId,
  STUDIO_BREAKPOINTS,
  STUDIO_COLUMNS,
  StudioAction,
  StudioDocumentV1,
  StudioOperation,
  StudioState,
} from './studioTypes';

/** Local proposal reducer, not permission to persist or execute a model operation. */
export function applyStudioOperation(document: StudioDocumentV1, operation: StudioOperation): StudioDocumentV1 {
  const next = validateStudioDocument(document);
  studioAssert(operation && typeof operation === 'object', '변경 작업을 확인해 주세요.');
  const fields = {
    addBlock: ['type', 'block'],
    duplicateBlock: ['type', 'blockId', 'newId'],
    removeBlock: ['type', 'blockId'],
    updateBlock: ['type', 'blockId', 'patch'],
    moveBlock: ['type', 'blockId', 'breakpoint', 'x', 'y'],
    resizeBlock: ['type', 'blockId', 'breakpoint', 'w', 'h'],
    renameDashboard: ['type', 'title'],
  };
  studioAssert(Object.prototype.hasOwnProperty.call(fields, operation.type), '지원하지 않는 변경 작업입니다.');
  studioKeys(operation, fields[operation.type]);
  if (operation.type === 'renameDashboard') next.title = operation.title;
  else if (operation.type === 'addBlock' || operation.type === 'duplicateBlock') {
    const original = operation.type === 'duplicateBlock' ? next.blocks.find(b => b.id === operation.blockId) : undefined;
    if (operation.type === 'duplicateBlock') studioAssert(original, '변경할 블록이 없습니다.');
    const template = operation.type === 'addBlock' ? operation.block : original;
    studioAssert(template, '새 블록 정의를 확인해 주세요.');
    const block = studioClone(template);
    if (operation.type === 'duplicateBlock') block.id = operation.newId;
    studioAssert(
      block && isTemporaryStudioId(block.id) && !next.blocks.some(b => b.id === block.id),
      '새 블록에는 새 임시 ID가 필요합니다.',
    );
    for (const bp of STUDIO_BREAKPOINTS) {
      const items = next.layouts[bp];
      const old = original && items.find(g => g.id === original.id);
      items.push({
        id: block.id,
        x: 0,
        y: Math.max(0, ...items.map(g => g.y + g.h)),
        w: old?.w ?? (bp === 'xs' ? 1 : block.kind === 'BOARD_NUMERIC' ? STUDIO_COLUMNS[bp] / 2 : STUDIO_COLUMNS[bp]),
        h: old?.h ?? (block.kind === 'BOARD_NUMERIC' ? 3 : 5),
      });
    }
    next.blocks.push(block);
  } else {
    const index = next.blocks.findIndex(b => b.id === operation.blockId);
    studioAssert(index >= 0, '변경할 블록이 없습니다.');
    if (operation.type === 'removeBlock') {
      next.blocks.splice(index, 1);
      for (const bp of STUDIO_BREAKPOINTS) next.layouts[bp] = next.layouts[bp].filter(g => g.id !== operation.blockId);
    } else if (operation.type === 'updateBlock') {
      studioKeys(operation.patch, ['title', 'description', 'definitionKey', 'measureRefs', 'dimensionRefs', 'display']);
      if (Object.prototype.hasOwnProperty.call(operation.patch, 'display'))
        studioKeys(operation.patch.display, ['decimalPlaces', 'numberNotation', 'prefix', 'suffix', 'timeGrain']);
      const patch = studioClone(operation.patch);
      next.blocks[index] = { ...next.blocks[index], ...patch, display: { ...next.blocks[index].display, ...patch.display } };
    } else {
      studioAssert(STUDIO_BREAKPOINTS.includes(operation.breakpoint), '화면 크기를 확인해 주세요.');
      const g = next.layouts[operation.breakpoint].find(item => item.id === operation.blockId);
      studioAssert(g, '변경할 배치가 없습니다.');
      if (operation.type === 'moveBlock') {
        g.x = operation.x;
        g.y = operation.y;
      } else {
        g.w = operation.w;
        g.h = operation.h;
      }
    }
  }
  return validateStudioDocument(next);
}
const withoutRevision = (document: StudioDocumentV1) => {
  const doc = validateStudioDocument(document);
  delete doc.revision;
  return doc;
};
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(key => [key, canonical(value[key])]),
      )
    : value;
const same = (a: StudioDocumentV1, b: StudioDocumentV1) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function createStudioState(document: StudioDocumentV1): StudioState {
  const present = withoutRevision(document);
  return {
    present,
    past: [],
    future: [],
    selectedBlockId: null,
    activeBreakpoint: 'lg',
    panel: null,
    saveState: 'clean',
    pendingSave: null,
    savedBaseline: studioClone(present),
    ...(document.revision ? { serverRevision: document.revision } : {}),
  };
}
function withPresent(state: StudioState, present: StudioDocumentV1): StudioState {
  return {
    ...state,
    present,
    selectedBlockId: present.blocks.some(b => b.id === state.selectedBlockId) ? state.selectedBlockId : null,
    saveState: same(present, state.savedBaseline) ? 'clean' : 'dirty',
  };
}
/** Save response remapping also reaches redo-only IDs; a remap never changes a persisted ID. */
export function remapStudioIds(state: StudioState, idMap: Record<string, string>): StudioState {
  studioAssert(idMap && typeof idMap === 'object' && !Array.isArray(idMap), 'ID 변환을 확인해 주세요.');
  const snapshots = [
    state.present,
    state.savedBaseline,
    ...state.past,
    ...state.future,
    ...(state.pendingSave ? [state.pendingSave.document] : []),
  ];
  const known = new Set(snapshots.flatMap(d => d.blocks.map(b => b.id)));
  const mapped = new Set<string>();
  for (const [from, to] of Object.entries(idMap)) {
    studioAssert(
      isTemporaryStudioId(from) &&
        known.has(from) &&
        isStudioId(to) &&
        !isTemporaryStudioId(to) &&
        !mapped.has(to) &&
        !known.has(to),
      '잘못된 블록 ID 변환입니다.',
    );
    mapped.add(to);
  }
  const id = (value: string) => (Object.prototype.hasOwnProperty.call(idMap, value) ? idMap[value] : value);
  const remap = (d: StudioDocumentV1) =>
    validateStudioDocument({
      ...d,
      blocks: d.blocks.map(b => ({ ...b, id: id(b.id) })),
      layouts: Object.fromEntries(STUDIO_BREAKPOINTS.map(bp => [bp, d.layouts[bp].map(g => ({ ...g, id: id(g.id) }))])),
    });
  return {
    ...state,
    present: remap(state.present),
    pendingSave: state.pendingSave ? { ...state.pendingSave, document: remap(state.pendingSave.document) } : null,
    savedBaseline: remap(state.savedBaseline),
    past: state.past.map(remap),
    future: state.future.map(remap),
    selectedBlockId: state.selectedBlockId === null ? null : id(state.selectedBlockId),
  };
}
export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'apply':
    case 'applyBatch': {
      const operations = action.type === 'apply' ? [action.operation] : action.operations;
      const doc = operations.reduce(applyStudioOperation, state.present);
      if (same(doc, state.present)) return state;
      return withPresent({ ...state, past: [...state.past, state.present].slice(-100), future: [] }, doc);
    }
    case 'undo': {
      if (!state.past.length) return state;
      return withPresent(
        { ...state, past: state.past.slice(0, -1), future: [state.present, ...state.future].slice(0, 100) },
        studioClone(state.past[state.past.length - 1]),
      );
    }
    case 'redo': {
      if (!state.future.length) return state;
      return withPresent(
        { ...state, past: [...state.past, state.present].slice(-100), future: state.future.slice(1) },
        studioClone(state.future[0]),
      );
    }
    case 'select':
      studioAssert(
        action.blockId === null || state.present.blocks.some(b => b.id === action.blockId),
        '선택할 블록이 없습니다.',
      );
      return { ...state, selectedBlockId: action.blockId };
    case 'breakpoint':
      studioAssert(STUDIO_BREAKPOINTS.includes(action.breakpoint), '화면 크기를 확인해 주세요.');
      return { ...state, activeBreakpoint: action.breakpoint };
    case 'panel':
      studioAssert([null, 'ai', 'settings'].includes(action.panel), '패널을 확인해 주세요.');
      return { ...state, panel: action.panel };
    case 'saveStarted': {
      studioText(action.requestId, 128);
      studioAssert(!state.pendingSave, '이미 저장을 진행 중입니다.');
      return {
        ...state,
        pendingSave: {
          requestId: action.requestId,
          document: studioClone(state.present),
          baseRevision: state.serverRevision,
        },
      };
    }
    case 'saveFailed': {
      studioAssert(state.pendingSave?.requestId === action.requestId, '저장 요청을 확인해 주세요.');
      return { ...state, pendingSave: null };
    }
    case 'saved': {
      studioAssert(
        typeof action.revision === 'string' && /^[a-f0-9]{64}$/.test(action.revision),
        '저장 revision을 확인해 주세요.',
      );
      const pending = state.pendingSave;
      studioAssert(
        pending && pending.requestId === action.requestId && pending.baseRevision === state.serverRevision,
        '저장 응답이 현재 요청과 다릅니다.',
      );
      studioAssert(
        action.idMap && typeof action.idMap === 'object' && !Array.isArray(action.idMap),
        'ID 변환을 확인해 주세요.',
      );
      const submitted = new Set(pending.document.blocks.filter(b => isTemporaryStudioId(b.id)).map(b => b.id));
      studioAssert(
        Array.from(submitted).every(id => Object.prototype.hasOwnProperty.call(action.idMap, id)) &&
          Object.keys(action.idMap).every(id => submitted.has(id)),
        '새 블록의 저장 ID가 누락되었거나 요청과 다릅니다.',
      );
      const next = remapStudioIds(state, action.idMap);
      const baseline = next.pendingSave.document;
      return {
        ...next,
        serverRevision: action.revision,
        savedBaseline: baseline,
        pendingSave: null,
        saveState: same(next.present, baseline) ? 'clean' : 'dirty',
      };
    }
    default:
      throw new Error('지원하지 않는 화면 작업입니다.');
  }
}
