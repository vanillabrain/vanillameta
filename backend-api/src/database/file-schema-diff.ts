/**
 * Structured diff between the active DuckDB file schema and an incoming replacement candidate.
 * Only column names and types leave this module; never SQL, file paths, credentials or rows.
 */
export const FILE_SCHEMA_DIFF_LIMIT = 25;

export type FileSchemaColumn = { name: string; type: string };

export type FileSchemaTypeChange = { name: string; from: string; to: string };

export type FileSchemaDiff = {
  changed: boolean;
  removed: FileSchemaColumn[];
  added: FileSchemaColumn[];
  typeChanged: FileSchemaTypeChange[];
  counts: { removed: number; added: number; typeChanged: number };
  truncated: boolean;
};

type NormalizedSchema = { list: FileSchemaColumn[]; pairKey: string };

/** Malformed entries are dropped; DESCRIBE always supplies string name/type values. */
function normalize(columns: readonly unknown[]): NormalizedSchema {
  const byName = new Map<string, string>();
  const pairs: string[] = [];
  for (const entry of Array.isArray(columns) ? columns : []) {
    const name = (entry as { name?: unknown } | null)?.name;
    const type = (entry as { type?: unknown } | null)?.type;
    if (typeof name !== 'string' || !name.trim()) continue;
    if (typeof type !== 'string' || !type.trim()) continue;
    pairs.push(JSON.stringify([name, type]));
    if (!byName.has(name)) byName.set(name, type);
  }
  pairs.sort();
  const list = [...byName.entries()]
    .map(([name, type]) => ({ name, type }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { list, pairKey: JSON.stringify(pairs) };
}

export function diffFileSchema(
  existing: readonly unknown[],
  incoming: readonly unknown[],
  limit: number = FILE_SCHEMA_DIFF_LIMIT,
): FileSchemaDiff {
  const cap = Number.isSafeInteger(limit) && limit > 0 ? limit : FILE_SCHEMA_DIFF_LIMIT;
  const before = normalize(existing);
  const after = normalize(incoming);
  const beforeTypes = new Map(before.list.map(column => [column.name, column.type]));
  const afterTypes = new Map(after.list.map(column => [column.name, column.type]));

  const removed = before.list.filter(column => !afterTypes.has(column.name));
  const added = after.list.filter(column => !beforeTypes.has(column.name));
  const typeChanged: FileSchemaTypeChange[] = [];
  for (const column of before.list) {
    const next = afterTypes.get(column.name);
    if (next !== undefined && next !== column.type)
      typeChanged.push({ name: column.name, from: column.type, to: next });
  }

  return {
    // Same order-insensitive pair comparison the replacement gate always used.
    changed: before.pairKey !== after.pairKey,
    removed: removed.slice(0, cap),
    added: added.slice(0, cap),
    typeChanged: typeChanged.slice(0, cap),
    counts: { removed: removed.length, added: added.length, typeChanged: typeChanged.length },
    truncated: removed.length > cap || added.length > cap || typeChanged.length > cap,
  };
}
