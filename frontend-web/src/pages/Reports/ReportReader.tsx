import React, { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import { PublishedBlockView } from '../Dashboard/Studio/PublishedBlockView';
import { reportSharingApi, readerBlocks } from './reportSharingApi';
import { useProtectedReport } from './useProtectedReport';
import ReportShares from './ReportShares';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import './reports.css';
export default function ReportReader() {
  const { reportId = '' } = useParams();
  return <Reader key={reportId} id={reportId} />;
}
function Reader({ id }: { id: string }) {
  const navigation = artifactListNavigation(useLocation());
  const { state, retained, boundary, reload } = useProtectedReport(signal => reportSharingApi.reader(id, signal));
  const [manage, setManage] = useState(false);
  const sessionScope = personalLibrarySessionScope() ?? '';
  return (
    <main className="private-reports bg-background text-foreground">
      <nav className="report-toolbar">
        <Link to={navigation.listHref}>Artifact 허브로 돌아가기</Link>
        <Button className="h-10" variant="outline" onClick={reload}>
          보고서 다시 읽기
        </Button>
        {retained?.data.role === 'owner' && (
          <Button className="h-10" onClick={() => setManage(value => !value)}>
            공유 관리
          </Button>
        )}
      </nav>
      {manage && (
        <ReportShares
          key={`${id}:${sessionScope}`}
          id={id}
          onAccessFailure={reload}
          reviewedVersion={state.kind === 'ready' && state.data.role === 'owner' ? state.data.version : null}
        />
      )}
      {state.kind === 'loading' && (
        <p role="status" className="my-8">
          현재 접근권을 확인하고 있습니다.
        </p>
      )}
      {state.kind === 'error' && (
        <div className="my-8">
          <p role="alert">{state.message}</p>
          <Button className="mt-4 h-10" variant="outline" onClick={() => setManage(value => !value)}>
            소유자 공유 관리
          </Button>
        </div>
      )}
      <div ref={boundary}>
        {state.kind === 'ready' && (
          <>
            <div className="report-heading gap-6">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  {state.data.role === 'owner' ? '내 보고서' : '받은 보고서'} · 고정 버전 {state.data.version}
                </p>
                <h1 className="break-words">{state.data.title}</h1>
              </div>
              {state.data.role === 'owner' && (
                <Button asChild className="h-10" variant="outline">
                  <Link to={navigation.link(`/reports/${id}`)}>편집</Link>
                </Button>
              )}
            </div>
            <p className="mb-6 text-sm text-muted-foreground">
              저장 {new Date(state.data.savedAt).toLocaleString()} · {state.data.period} · {state.data.timeZone} · 집계 포착{' '}
              {new Date(state.data.capturedAt).toLocaleString()}
            </p>
            <p className="mb-6 text-sm text-muted-foreground">
              저장 당시의 본문과 집계입니다. 이후 편집은 자동 전달되지 않으며 원본 데이터 접근권은 포함하지 않습니다.
            </p>
            <div className="report-editor-grid">
              <article
                aria-label="보고서 본문"
                className="whitespace-pre-wrap break-words rounded-xl border bg-card p-6 text-base leading-8"
              >
                {state.data.body}
              </article>
              <div className="report-results">
                {readerBlocks(state.data).map(block => (
                  <section key={block.id} className="report-frozen-block rounded-xl border bg-card">
                    <PublishedBlockView block={block} />
                  </section>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
