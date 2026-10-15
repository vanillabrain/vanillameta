import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Typography } from '@mui/material';
import { AnalysisUiProvider } from '@/components/analysis/AnalysisUi';
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
      <Box
        component="main"
        sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1600, width: '100%', boxSizing: 'border-box', mx: 'auto', minWidth: 0 }}
      >
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : !result ? (
          <Typography role="status">게시 결과를 불러오는 중…</Typography>
        ) : (
          <>
            <Typography sx={{ fontSize: 12, color: '#64748b', overflowWrap: 'anywhere' }}>
              링크 공유 · 게시 버전 {result.version} · 게시 {result.publishedAt} · 만료 {result.expiresAt}
            </Typography>
            <SnapshotView snapshot={result.snapshot} />
          </>
        )}
      </Box>
    </AnalysisUiProvider>
  );
}
