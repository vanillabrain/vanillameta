import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateStudioDocument, assertStudioReferences } from './studio-document';

const fixture = () =>
  JSON.parse(readFileSync(resolve(__dirname, '../../../fixtures/studio/document-v1.json'), 'utf8'));
const context = () => ({
  sourceId: 7,
  sourceSchemaVersion: 'source-v1',
  definitionKeys: new Set(['definition:b1', 'definition:b2']),
  measureVersions: new Map([[10, 'metric-v1']]),
  dimensionKeys: new Set(['device_type']),
});

describe('Studio document server contract', () => {
  it('accepts the shared fixture and returns a detached document', () => {
    const input = fixture();
    const result = validateStudioDocument(input);
    expect(result).toEqual(input);
    result.blocks[0].display.prefix = '$';
    expect(input.blocks[0].display.prefix).toBeUndefined();
  });
  it('rejects sparse layouts rather than returning null layout entries', () => {
    const input = fixture();
    input.layouts.md = Array(2);
    expect(() => validateStudioDocument(input)).toThrow();
  });
  it('accepts maximum safe bottom coordinates and stored ID length', () => {
    const input = fixture();
    input.layouts.lg[1].y = Number.MAX_SAFE_INTEGER - 5;
    const id = 'a'.repeat(128);
    input.blocks[0].id = id;
    Object.values(input.layouts).forEach((items: any[]) => {
      items[0].id = id;
    });
    expect(validateStudioDocument(input)).toEqual(input);
  });
  it('allows an empty draft', () => {
    const input = fixture();
    input.blocks = [];
    input.layouts = { lg: [], md: [], xs: [] };
    expect(validateStudioDocument(input).blocks).toEqual([]);
  });
  it.each(['persisted_ID-9', 'new:00000000-0000-0000-0000-000000000001'])(
    'accepts protocol identity %s',
    id => {
      const input = fixture();
      input.blocks[0].id = id;
      Object.values(input.layouts).forEach((items: any[]) => {
        items[0].id = id;
      });
      expect(validateStudioDocument(input).blocks[0].id).toBe(id);
    },
  );
  it.each([
    (d: any) => {
      d.sql = 'SELECT 1';
    },
    (d: any) => {
      d.blocks[0].display.raw = true;
    },
    (d: any) => {
      d.blocks[0].measureRefs[0].extra = true;
    },
    (d: any) => {
      d.blocks[1].dimensionRefs[0].extra = true;
    },
    (d: any) => {
      d.blocks[0].unknown = true;
    },
    (d: any) => {
      d.layouts.lg[0].extra = true;
    },
    (d: any) => {
      d.layouts.extra = [];
    },
    (d: any) => {
      d.blocks[1].id = d.blocks[0].id;
    },
    (d: any) => {
      d.blocks[0].id = 'new:bad';
    },
    (d: any) => {
      d.blocks[0].id = 'a'.repeat(129);
    },
    (d: any) => {
      d.blocks[0].kind = 'RAW_SQL';
    },
    (d: any) => {
      d.blocks[1].dimensionRefs[0].sourceId = 8;
    },
    (d: any) => {
      d.layouts.md.pop();
    },
    (d: any) => {
      d.layouts.xs[0].id = 'unknown';
    },
    (d: any) => {
      d.layouts.lg[1].x = 0;
    },
    (d: any) => {
      d.layouts.lg[0].y = Number.MAX_SAFE_INTEGER;
    },
    (d: any) => {
      d.layouts.lg[0].y = 1e100;
    },
    (d: any) => {
      d.layouts.lg[0].x = 0.5;
    },
    (d: any) => {
      d.layouts.lg[0].w = 13;
    },
    (d: any) => {
      d.sourceId = 0;
    },
    (d: any) => {
      d.revision = 'invalid';
    },
    (d: any) => {
      d.title = 'a'.repeat(301);
    },
    (d: any) => {
      d.blocks[0].measureRefs.push(d.blocks[0].measureRefs[0]);
    },
    (d: any) => {
      d.blocks[1].dimensionRefs.push(d.blocks[1].dimensionRefs[0]);
    },
    (d: any) => {
      d.blocks[0].display.decimalPlaces = 7;
    },
    (d: any) => {
      d.blocks = Array(7).fill(d.blocks[0]);
    },
  ])('rejects malformed documents without modifying input %#', change => {
    const input = fixture();
    change(input);
    const before = JSON.stringify(input);
    expect(() => validateStudioDocument(input)).toThrow();
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([null, [], 1, {}, { schemaVersion: 2 }])('rejects malformed roots %#', input => {
    expect(() => validateStudioDocument(input)).toThrow();
  });
  it('checks supplied references independently of structural validation', () => {
    const input = fixture();
    expect(() => assertStudioReferences(input, context())).not.toThrow();
    expect(input).toEqual(fixture());
  });
  it.each([
    (c: ReturnType<typeof context>) => {
      c.sourceId = 8;
    },
    (c: ReturnType<typeof context>) => {
      c.definitionKeys.delete('definition:b1');
    },
    (c: ReturnType<typeof context>) => {
      c.measureVersions.delete(10);
    },
    (c: ReturnType<typeof context>) => {
      c.measureVersions.set(10, 'metric-v2');
    },
    (c: ReturnType<typeof context>) => {
      c.dimensionKeys.clear();
    },
  ])('rejects unavailable or mismatched live references %#', change => {
    const c = context();
    change(c);
    expect(() => assertStudioReferences(fixture(), c)).toThrow();
  });
});

it('rejects a dimension from a different source schema version', () => {
  const doc = fixture();
  doc.blocks[1].dimensionRefs[0].schemaVersion = 'stale-schema';
  expect(() => assertStudioReferences(doc, context())).toThrow();
});
