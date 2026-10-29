import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import { reportApi } from './reportApi';
import { useProtectedReport } from './useProtectedReport';
import './reports.css';
export default function Reports() {
  const navigation = artifactListNavigation(useLocation());
  const { state, boundary, reload } = useProtectedReport(signal => reportApi.list(signal));
  return (
    <main className="private-reports bg-background text-foreground">
      <nav className="report-toolbar">
        <Link to={navigation.listHref}>Artifact 허브로 돌아가기</Link>
        <Button variant="outline" className="h-10" onClick={reload}>
          목록 새로고침
        </Button>
      </nav>
      <h1>내 보고서</h1>
      <p className="text-muted-foreground">
        작성한 본문과 저장 당시의 숫자를 함께 보존합니다. 새 보고서는 본인이 소유한 저장 Studio에서 시작하세요. 받은 보고서는
        Artifact 허브에서 확인할 수 있습니다.
      </p>
      {state.kind === 'loading' && <p role="status">보고서를 불러오는 중입니다.</p>}
      {state.kind === 'error' && <p role="alert">{state.message}</p>}
      <div ref={boundary}>
        {state.kind === 'ready' &&
          (state.data.length ? (
            <ul className="report-list">
              {state.data.map(item => (
                <li key={item.id} className="rounded-lg border bg-card">
                  <Link to={navigation.link('/reports/' + item.id + '/read')}>
                    <strong>{item.title}</strong>
                    <span className="text-muted-foreground">{new Date(item.updatedAt).toLocaleString()} · 내 보고서</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>아직 저장된 보고서가 없습니다. Studio의 ‘비공개 보고서 작성’을 선택하세요.</p>
          ))}
      </div>
    </main>
  );
}
