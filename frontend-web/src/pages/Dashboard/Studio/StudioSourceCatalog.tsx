import {
  BusinessSemantics,
  businessTypeLabels,
  validBusinessSemantics,
  variableText,
} from '@/pages/Explore/businessVariable';
import React, { useEffect, useId, useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SourceProfile } from './studioCreation';
type Catalog = {
  sourceId: number;
  sourceRevision: string;
  version: number;
  label: string;
  description: string;
  schemaChanged: boolean;
  columns: Array<{ column: string; type: string; label: string; description: string; unit: string } & BusinessSemantics>;
};
export default function StudioSourceCatalog({ profile }: { profile: SourceProfile }) {
  const key = JSON.stringify([profile.sourceId, profile.dataVersion, profile.columns.map(c => [c.name, c.type])]);
  return <CatalogPanel key={key} profile={profile} />;
}
function CatalogPanel({ profile }: { profile: SourceProfile }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  // The keyed panel owns this snapshot; unrelated composer renders must not refetch.
  const snapshot = useRef(profile).current;
  return (
    <section className="mt-3 min-w-0 border-t border-border pt-3" aria-label="선택 데이터 업무 설명">
      <Button type="button" size="sm" variant="ghost" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        데이터 업무 설명 확인
      </Button>
      {open && (
        <div id={id} className="mt-3 min-w-0">
          <CatalogRead profile={snapshot} />
        </div>
      )}
    </section>
  );
}
function CatalogRead({ profile }: { profile: SourceProfile }) {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!profile.dataVersion) return;
    setBusy(true);
    setData(null);
    setError('');
    post('/bi/source-catalog/read', { sourceId: profile.sourceId })
      .then(response => {
        const next = response?.data?.data as Catalog;
        if (
          response?.data?.status !== 'SUCCESS' ||
          !next ||
          !Number.isSafeInteger(next.version) ||
          next.version < 0 ||
          typeof next.label !== 'string' ||
          typeof next.description !== 'string' ||
          typeof next.schemaChanged !== 'boolean' ||
          !Array.isArray(next.columns) ||
          next.columns.some(
            c =>
              !c ||
              ['column', 'type', 'label', 'description', 'unit'].some(field => typeof c[field] !== 'string') ||
              !validBusinessSemantics(c),
          )
        )
          throw new Error('invalid metadata');
        // UC050: business descriptions are never applied to a different data/schema snapshot.
        if (
          next.sourceId !== profile.sourceId ||
          next.sourceRevision !== profile.dataVersion ||
          next.schemaChanged ||
          next.columns.length !== profile.columns.length ||
          new Set(next.columns.map(c => c.column)).size !== next.columns.length ||
          profile.columns.some(c => !next.columns.some(n => n.column === c.name && n.type === c.type))
        ) {
          if (active) setError('현재 데이터와 업무 설명의 기준이 다릅니다. 소스 새로 확인 후 다시 조회해 주세요.');
          return;
        }
        if (active) setData(next);
      })
      .catch(() => {
        if (active) setError('업무 설명을 확인하지 못했습니다. 질문과 생성안은 유지됩니다. 다시 조회해 주세요.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [profile, attempt]);
  if (!profile.dataVersion) return <Notice severity="info">소스 새로 확인 후 업무 설명을 조회해 주세요.</Notice>;
  return (
    <div className="min-w-0 space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        저장된 업무 설명을 참고합니다. 질문이나 지표·차트에 자동 적용하지 않습니다.
      </p>
      {busy && <p role="status">업무 설명을 확인하고 있습니다…</p>}
      {error && <Notice severity="error">{error}</Notice>}
      {data?.version === 0 && <p role="status">아직 저장된 업무 설명이 없습니다.</p>}
      {data && data.version > 0 && (
        <div className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
          <p className="text-xs text-muted-foreground">업무 설명 저장 버전 {data.version}</p>
          <p className="font-medium">{data.label}</p>
          {data.description && <p className="whitespace-pre-wrap">{data.description}</p>}
          <ul aria-label="열별 업무 설명" className="min-w-0 space-y-2">
            {profile.columns.map(column => {
              const c = data.columns.find(item => item.column === column.name);
              if (!c) return null;
              return (
                <li key={c.column} className="min-w-0 space-y-1 rounded-md border border-border p-3">
                  <p className="font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">
                    원본 열: <span>{c.column}</span> · 형식: <span>{c.type}</span>
                  </p>
                  <p className="text-xs">업무 유형: {businessTypeLabels[c.businessType ?? 'auto']}</p>
                  {c.businessType === 'date' && (
                    <p className="text-xs">날짜 형식: {variableText('dateFormat', c.dateFormat ?? '')}</p>
                  )}
                  {c.classification && <p className="text-xs">업무 분류: {c.classification}</p>}
                  {c.unit && (
                    <p className="text-xs">
                      단위: <span>{c.unit}</span>
                    </p>
                  )}
                  {c.description && <p className="whitespace-pre-wrap">{c.description}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setAttempt(value => value + 1)}>
        업무 설명 다시 조회
      </Button>
    </div>
  );
}
