import React, { Suspense } from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '@/layouts/PublicLayout';
const StudioPublished = React.lazy(() => import('@/pages/Dashboard/Studio/PublishedDashboard'));
const AnalysisPublished = React.lazy(() => import('@/pages/Publication/Published'));

/** Both issued URL formats stay valid; never probe two APIs or fall back after a refusal. */
export function publicationKind(token: string): 'studio' | 'analysis' | 'invalid' {
  if (/^[a-f0-9]{64}$/.test(token)) return 'studio';
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(token)) return 'analysis';
  return 'invalid';
}
export default function PublishedRoute() {
  const { token = '' } = useParams();
  const kind = publicationKind(token);
  return (
    <Suspense fallback={<p role="status">게시 결과를 불러오는 중…</p>}>
      {kind === 'studio' ? (
        <StudioPublished />
      ) : (
        <PublicLayout>
          {kind === 'analysis' ? <AnalysisPublished /> : <p role="alert">게시 링크 형식을 확인해 주세요.</p>}
        </PublicLayout>
      )}
    </Suspense>
  );
}
