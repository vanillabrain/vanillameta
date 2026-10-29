import { useReportSession, isReportSession } from './reportSession';
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import { reportApi, reportError } from './reportApi';
import './reports.css';
export default function Reports() {
  const scope = useReportSession();
  if (!scope)
    return (
      <main className="private-reports">
        <p role="alert">로그인한 뒤 비공개 보고서를 열어 주세요.</p>
      </main>
    );
  return <ReportList key={scope} sessionScope={scope} />;
}
function ReportList({ sessionScope }: { sessionScope: string }) {
  const navigation = artifactListNavigation(useLocation());
  const [items, setItems] = useState<Awaited<ReturnType<typeof reportApi.list>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    if (!isReportSession(sessionScope)) return;
    reportApi
      .list()
      .then(value => {
        if (current && isReportSession(sessionScope)) setItems(value);
      })
      .catch(cause => {
        if (current && isReportSession(sessionScope)) setError(reportError(cause));
      })
      .finally(() => {
        if (current && isReportSession(sessionScope)) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [reload]);
  return (
    <main className="private-reports bg-background text-foreground">
      <nav className="report-toolbar">
        <Link to={navigation.listHref}>Artifact 허브로 돌아가기</Link>
        <Button variant="outline" className="h-10" onClick={() => setReload(value => value + 1)}>
          목록 새로고침
        </Button>
      </nav>
      <h1>비공개 보고서</h1>
      <p className="text-muted-foreground">
        작성한 본문과 저장 당시의 숫자를 함께 보존합니다. 새 보고서는 본인이 소유한 저장 Studio에서 시작하세요.
      </p>
      {loading ? (
        <p role="status">보고서를 불러오는 중입니다.</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : items.length ? (
        <ul className="report-list">
          {items.map(item => (
            <li key={item.id} className="rounded-lg border bg-card">
              <Link to={navigation.link('/reports/' + item.id)}>
                <strong>{item.title}</strong>
                <span className="text-muted-foreground">{new Date(item.updatedAt).toLocaleString()} · 비공개</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>아직 저장된 보고서가 없습니다. Studio의 ‘비공개 보고서 작성’을 선택하세요.</p>
      )}
    </main>
  );
}
