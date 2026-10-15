import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnalysisUiProvider } from '@/components/analysis/AnalysisUi';
import { Notice } from '@/components/ui/notice';
import SnapshotView, { Snapshot } from './SnapshotView';

type Result = {
  version: number;
  publishedAt: string;
  expiresAt: string;
  dataMode: 'snapshot';
  visibility: 'link';
  snapshot: Snapshot;
};
export default function Published() {
  const { publicationUuid = '' } = useParams();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    sequence.current += 1;
    const token = sequence.current;
    const abort = new AbortController();
    setResult(null);
    setError('');
    // No auth or share token: this page only reads the bounded publication result.
    const api = String(import.meta.env.REACT_APP_API_URL || '').replace(/\/$/, '');
    fetch(`${api}/publications/${encodeURIComponent(publicationUuid)}`, { signal: abort.signal, credentials: 'omit' })
      .then(async response => {
        if (!response.ok) throw new Error('게시가 중지되었거나 만료된 링크입니다.');
        const body = await response.json();
        const value = body?.data;
        if (
          body.status !== 'SUCCESS' ||
          !Array.isArray(value?.snapshot?.widgets) ||
          value.snapshot.schemaVersion !== 1 ||
          value.dataMode !== 'snapshot'
        )
          throw new Error('게시 결과를 확인할 수 없습니다.');
        if (token === sequence.current) setResult(value);
      })
      .catch(failure => {
        if (token === sequence.current && !abort.signal.aborted) setError(failure.message);
      });
    return () => {
      sequence.current += 1;
      abort.abort();
    };
  }, [publicationUuid]);
  return (
    <AnalysisUiProvider>
      <main className="mx-auto box-border w-full min-w-0 max-w-[1600px] p-4 sm:p-6">
        {error ? (
          <Notice severity="error">{error}</Notice>
        ) : !result ? (
          <p role="status">게시 결과를 불러오는 중…</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              링크 공유 · 게시 버전 {result.version} · 게시 {result.publishedAt} · 만료 {result.expiresAt}
            </p>
            <SnapshotView snapshot={result.snapshot} />
          </>
        )}
      </main>
    </AnalysisUiProvider>
  );
}
