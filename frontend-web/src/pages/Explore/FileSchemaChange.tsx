import React from 'react';
/** Structured owner-only schema rejection; ignore arbitrary server fields and cap visible detail. */
export default function FileSchemaChange({ value }: { value: unknown }) {
  const envelope = value as any;
  const body = envelope?.data ?? envelope;
  if (body?.code !== 'FILE_SCHEMA_CHANGED' || !body.changes) return null;
  const changes = body.changes;
  const text = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v.slice(0, 256) : null);
  const lines: string[] = [];
  for (const key of ['added', 'removed', 'typeChanged']) {
    if (!Array.isArray(changes[key])) continue;
    for (const entry of changes[key].slice(0, 25)) {
      const name = text(entry?.name);
      if (!name) continue;
      if (key === 'typeChanged') {
        const from = text(entry?.from),
          to = text(entry?.to);
        if (from && to) lines.push(`타입 변경: ${name} (${from} → ${to})`);
      } else {
        const type = text(entry?.type);
        if (type) lines.push(`${key === 'added' ? '추가' : '삭제'}: ${name} (${type})`);
      }
    }
  }
  if (!lines.length) return null;
  return (
    <section
      role="region"
      aria-label="열 구성 변경 내역"
      className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-sm"
    >
      <p className="font-semibold">열 구성이 달라 교체하지 않았습니다</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 [overflow-wrap:anywhere]">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {changes.truncated === true && <p className="mt-2">변경 항목이 많아 일부만 표시합니다.</p>}
      <p className="mt-2 text-muted-foreground">
        기존 데이터와 버전을 유지했습니다. 위 열을 확인해 같은 형식으로 수정하거나 새 데이터 소스로 연결해 주세요.
      </p>
    </section>
  );
}
