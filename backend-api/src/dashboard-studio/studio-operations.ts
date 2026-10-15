import {
  isStudioId,
  isTemporaryStudioId,
  STUDIO_BREAKPOINTS,
  STUDIO_COLUMNS,
  StudioBlock,
  StudioDocumentV1,
  StudioOperation,
} from './studio-contract';
import { studioAssert, studioKeys, validateStudioDocument } from './studio-document';

const CONTENT_FIELDS = [
  'title',
  'description',
  'definitionKey',
  'measureRefs',
  'dimensionRefs',
  'display',
] as const;

/** Apply one untrusted operation atomically; validate before returning any detached result. */
export function applyStudioOperation(
  document: StudioDocumentV1,
  operation: unknown,
): StudioDocumentV1 {
  const next = validateStudioDocument(document);
  studioKeys(operation, [
    'type',
    'block',
    'blockId',
    'newId',
    'patch',
    'breakpoint',
    'x',
    'y',
    'w',
    'h',
    'title',
  ]);
  const op = operation as unknown as StudioOperation;

  function findBlock(id: string): StudioBlock {
    studioAssert(isStudioId(id), 'Invalid Studio block ID.');
    const block = next.blocks.find(candidate => candidate.id === id);
    studioAssert(block, 'Unknown Studio block.');
    return block;
  }

  function append(block: StudioBlock, duplicateId?: string): void {
    studioAssert(
      isTemporaryStudioId(block.id) && !next.blocks.some(item => item.id === block.id),
      'A new unique temporary Studio ID is required.',
    );
    next.blocks.push(block);
    for (const breakpoint of STUDIO_BREAKPOINTS) {
      const items = next.layouts[breakpoint];
      const original =
        duplicateId === undefined ? undefined : items.find(item => item.id === duplicateId);
      const numeric = block.kind === 'BOARD_NUMERIC';
      items.push({
        id: block.id,
        x: 0,
        y: Math.max(0, ...items.map(item => item.y + item.h)),
        w: original
          ? original.w
          : numeric
          ? ({ lg: 6, md: 4, xs: 1 } as const)[breakpoint]
          : STUDIO_COLUMNS[breakpoint],
        h: original ? original.h : numeric ? 3 : 5,
      });
    }
  }

  switch (op.type) {
    case 'addBlock':
      studioKeys(op, ['type', 'block']);
      studioKeys(op.block, [
        'id',
        'kind',
        'definitionKey',
        'title',
        'description',
        'measureRefs',
        'dimensionRefs',
        'display',
      ]);
      append(op.block);
      break;
    case 'duplicateBlock': {
      studioKeys(op, ['type', 'blockId', 'newId']);
      const original = findBlock(op.blockId);
      append({ ...original, id: op.newId }, original.id);
      break;
    }
    case 'removeBlock':
      studioKeys(op, ['type', 'blockId']);
      findBlock(op.blockId);
      next.blocks = next.blocks.filter(block => block.id !== op.blockId);
      for (const breakpoint of STUDIO_BREAKPOINTS) {
        next.layouts[breakpoint] = next.layouts[breakpoint].filter(item => item.id !== op.blockId);
      }
      break;
    case 'updateBlock': {
      studioKeys(op, ['type', 'blockId', 'patch']);
      const block = findBlock(op.blockId);
      studioKeys(op.patch, CONTENT_FIELDS);
      const display = block.display;
      if (Object.prototype.hasOwnProperty.call(op.patch, 'display')) {
        studioKeys(op.patch.display, [
          'decimalPlaces',
          'numberNotation',
          'prefix',
          'suffix',
          'timeGrain',
        ]);
      }
      Object.assign(block, op.patch);
      block.display = { ...display, ...op.patch.display };
      break;
    }
    case 'moveBlock':
    case 'resizeBlock': {
      studioKeys(
        op,
        op.type === 'moveBlock'
          ? ['type', 'blockId', 'breakpoint', 'x', 'y']
          : ['type', 'blockId', 'breakpoint', 'w', 'h'],
      );
      findBlock(op.blockId);
      studioAssert(STUDIO_BREAKPOINTS.includes(op.breakpoint), 'Unknown Studio breakpoint.');
      const item = next.layouts[op.breakpoint].find(candidate => candidate.id === op.blockId);
      if (op.type === 'moveBlock') {
        item.x = op.x;
        item.y = op.y;
      } else {
        item.w = op.w;
        item.h = op.h;
      }
      break;
    }
    case 'renameDashboard':
      studioKeys(op, ['type', 'title']);
      next.title = op.title;
      break;
    default:
      throw new Error('Unsupported Studio operation.');
  }
  return validateStudioDocument(next);
}
