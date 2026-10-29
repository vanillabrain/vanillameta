import { useReportSession, isReportSession } from './reportSession';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { artifactListNavigation } from '@/helpers/artifactNavigation';
import { PublishedBlockView } from '../Dashboard/Studio/PublishedBlockView';
import {
  Report,
  ReportRoot,
  ReportPreview,
  ReportCommand,
  reportApi,
  reportBlocks,
  reportError,
  commandSchema,
} from './reportApi';
import {
  ReportPending,
  reportPendingKey,
  readReportPending,
  storeReportPending,
  removeReportPending,
} from './reportPending';
import './reports.css';

export default function ReportEditor() {
  const scope = useReportSession();
  const { reportId } = useParams();
  const location = useLocation();
  const dashboard = new URLSearchParams(location.search).get('dashboardId');
  if (!scope)
    return (
      <main className="private-reports">
        <p role="alert">로그인 상태가 변경됐습니다. 다시 로그인한 뒤 보고서를 열어 주세요.</p>
      </main>
    );
  return <ReportWorkspace key={JSON.stringify([scope, reportId ?? 'new', dashboard])} sessionScope={scope} />;
}
function ReportWorkspace({ sessionScope }: { sessionScope: string }) {
  const { reportId: routeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = artifactListNavigation(location);
  const dashboardParam = Number(new URLSearchParams(location.search).get('dashboardId'));
  const [id, setId] = useState(() => routeId || crypto.randomUUID());
  const [saved, setSaved] = useState<Report | null>(null);
  const [root, setRoot] = useState<ReportRoot | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kpiId, setKpiId] = useState('');
  const [chartId, setChartId] = useState('');
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [pending, setPending] = useState<ReportPending | null>(null);
  const [busy, setBusy] = useState<'load' | 'preview' | 'save' | 'outcome' | null>('load');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const key = useRef<string | null>(null);
  const generation = useRef(0);
  const current = (token = generation.current) => generation.current === token && isReportSession(sessionScope);
  const snapshot = preview?.snapshot ?? saved?.snapshot;
  const selectionChanged =
    !!saved && (kpiId !== saved.snapshot.basis.selection.kpiId || chartId !== saved.snapshot.basis.selection.chartId);
  const dashboardId = saved?.snapshot.basis.dashboardId ?? root?.dashboardId ?? dashboardParam;
  const accept = (report: Report) => {
    setSaved(report);
    setId(report.reportId);
    setTitle(report.title);
    setBody(report.body);
    setPreview(null);
    setKpiId(report.snapshot.basis.selection.kpiId);
    setChartId(report.snapshot.basis.selection.chartId);
  };
  useEffect(() => {
    generation.current += 1;
    const token = generation.current;
    setBusy('load');
    setError('');
    setSaved(null);
    setRoot(null);
    setPreview(null);
    setPending(null);
    key.current = null;
    let loaded = false;
    (async () => {
      if (!current(token)) return;
      const report = routeId ? await reportApi.read(routeId) : null;
      if (!current(token)) return;
      const options = report ? null : await reportApi.root(dashboardParam);
      if (!current(token)) return;
      const dashboard = report?.snapshot.basis.dashboardId ?? options.dashboardId;
      const org = report?.organizationId ?? options?.organizationId ?? null;
      const storageKey = await reportPendingKey(dashboard, org, routeId ?? 'new');
      if (!current(token)) return;
      key.current = storageKey;
      if (report) accept(report);
      else {
        setRoot(options);
        setTitle(options.title + ' 보고서');
        setBody('');
        setKpiId(options.blocks.find(block => block.kind === 'BOARD_NUMERIC')?.id ?? '');
        setChartId(options.blocks.find(block => block.kind !== 'BOARD_NUMERIC')?.id ?? '');
      }
      loaded = true;
      const ticket = readReportPending(storageKey);
      if (
        ticket &&
        ticket.dashboardId === dashboard &&
        ticket.command.expectedOrganizationId === org &&
        (!routeId || ticket.reportId === routeId)
      ) {
        setPending(ticket);
        setId(ticket.reportId);
        setTitle(ticket.command.title);
        setBody(ticket.command.body);
        const outcome = await reportApi.outcome(ticket.reportId, ticket.command.requestId, dashboard);
        if (!current(token)) return;
        setMessage(
          outcome.status === 'committed'
            ? `이 요청은 r${outcome.report.version}으로 저장됐습니다. 저장 결과를 열어 확인하세요.`
            : '저장 결과를 찾지 못했습니다. 서버 취소를 뜻하지 않습니다. 명시적으로 같은 요청을 다시 보내거나 결과를 재조회하세요.',
        );
      }
    })()
      .catch(cause => {
        if (current(token)) setError(reportError(cause, loaded ? 'action' : 'load'));
      })
      .finally(() => {
        if (current(token)) setBusy(null);
      });
    return () => {
      generation.current += 1;
    };
  }, [routeId, dashboardParam, loadAttempt]);

  const checkOutcome = async (open: boolean) => {
    if (!current() || !pending || busy) return;
    const token = generation.current;
    setBusy('outcome');
    setError('');
    try {
      const result = await reportApi.outcome(pending.reportId, pending.command.requestId, pending.dashboardId);
      if (!current(token)) return;
      if (result.status === 'committed') {
        setMessage(`요청이 r${result.report.version}으로 저장됐습니다.`);
        if (open) {
          const latest = await reportApi.read(pending.reportId);
          if (!current(token)) return;
          if (!removeReportPending(key.current)) throw new Error('storage');
          setPending(null);
          accept(latest);
          setMessage(`이 요청의 영수증은 r${result.report.version}입니다. 현재 저장본 r${latest.version}을 열었습니다.`);
          navigate(navigation.link('/reports/' + latest.reportId), { replace: true });
        }
      } else setMessage('아직 저장 결과가 없습니다. 자동 저장하지 않습니다. 같은 요청을 다시 보낼 수 있습니다.');
    } catch (cause) {
      if (current(token)) setError(reportError(cause));
    } finally {
      if (current(token)) setBusy(null);
    }
  };
  const calculate = async () => {
    if (!current() || busy || pending) return;
    const token = generation.current;
    setBusy('preview');
    setError('');
    try {
      const currentRoot = await reportApi.root(dashboardId);
      if (!current(token)) return;
      setRoot(currentRoot);
      const selection = { dashboardId, expectedDashboardRevision: currentRoot.revision, kpiId, chartId };
      const result = await reportApi.preview(id, currentRoot.organizationId, selection);
      if (!current(token)) return;
      setPreview(result);
      setMessage('현재 데이터 미리보기입니다. 숫자와 기준을 확인한 뒤 비공개 저장을 선택하세요.');
    } catch (cause) {
      if (current(token)) {
        setPreview(null);
        setError(reportError(cause));
      }
    } finally {
      if (current(token)) setBusy(null);
    }
  };
  const send = async (ticket: ReportPending) => {
    if (!current()) return;
    const token = generation.current;
    setBusy('save');
    setError('');
    try {
      const result = await reportApi.save(ticket.reportId, ticket.command);
      if (!current(token)) return;
      const latest = result.replayed ? await reportApi.read(ticket.reportId) : result.report;
      if (!current(token)) return;
      if (!removeReportPending(key.current)) throw new Error('storage');
      setPending(null);
      accept(latest);
      setMessage(
        result.replayed
          ? `기존 요청은 r${result.report.version}으로 저장됐습니다. 현재 저장본 r${latest.version}을 열었습니다.`
          : `비공개 r${latest.version} 저장 완료. 숫자는 저장 당시 기준으로 고정됩니다.`,
      );
      navigate(navigation.link('/reports/' + latest.reportId), { replace: true });
    } catch (cause) {
      if (current(token)) setError(reportError(cause));
    } finally {
      if (current(token)) setBusy(null);
    }
  };
  const save = () => {
    if (!current() || busy || pending || (!preview && (!saved || selectionChanged))) return;
    let command: ReportCommand;
    try {
      command = commandSchema.parse({
        requestId: crypto.randomUUID(),
        expectedOrganizationId: saved?.organizationId ?? root?.organizationId ?? null,
        expectedRevision: saved?.revision ?? null,
        title,
        body,
        data: preview
          ? {
              mode: 'capture',
              capture: {
                dashboardId,
                expectedDashboardRevision: preview.snapshot.basis.dashboardRevision,
                ...preview.snapshot.basis.selection,
              },
              previewDigest: preview.previewDigest,
            }
          : { mode: 'retain', fromRevision: saved.revision },
      });
    } catch {
      setError('제목은 1~200자, 본문은 UTF-8 64KiB 이내로 입력해 주세요.');
      return;
    }
    const ticket: ReportPending = { version: 1, reportId: id, dashboardId, updatedAt: Date.now(), command };
    if (!storeReportPending(key.current, ticket)) {
      setError('탭 저장소에 요청을 보관하지 못해 전송하지 않았습니다. 초안을 복사하고 저장소를 확인해 주세요.');
      return;
    }
    setPending(ticket);
    void send(ticket);
  };
  const release = () => {
    if (!current() || busy) return;
    if (!removeReportPending(key.current)) {
      setError('보관한 요청을 해제하지 못했습니다.');
      return;
    }
    setPending(null);
    setPreview(null);
    setMessage('보관을 해제했습니다. 서버 요청을 취소한 것은 아닙니다. 기존 본문은 유지합니다.');
  };
  const loaded = !!saved || !!root;
  const bytes = new TextEncoder().encode(body).length;
  return (
    <main className="private-reports bg-background text-foreground">
      <nav className="report-toolbar">
        <Link to={navigation.link('/reports')}>비공개 보고서 목록</Link>
        <Link to={navigation.listHref}>Artifact 허브</Link>
        {dashboardId > 0 && <Link to={navigation.link(`/dashboard/${dashboardId}/studio`)}>원본 Studio</Link>}
      </nav>
      <header className="report-heading">
        <div>
          <p className="text-sm text-muted-foreground">본인만 보는 고정 보고서</p>
          <h1>{loaded ? (saved ? '매출 보고서' : '비공개 보고서 작성') : '비공개 보고서 불러오기'}</h1>
        </div>
        <span className="rounded-full border px-3 py-1 text-sm">
          {loaded ? (saved ? `저장본 r${saved.version}` : '작성 중') : busy ? '조회 중' : '조회 실패'}
        </span>
      </header>
      {loaded && (
        <p className="text-muted-foreground">
          본문은 직접 작성합니다. 숫자는 저장 당시 기준으로 고정되며, 새 데이터는 명시적으로 미리보기 한 뒤 저장합니다. 본인
          소유 소스만 지원합니다.
        </p>
      )}
      {error && (
        <p className="report-notice border-destructive text-destructive" role="alert">
          {error}
        </p>
      )}
      <p role="status" className="report-status">
        {busy
          ? {
              load: '불러오는 중…',
              preview: '현재 기준을 계산하는 중…',
              save: '비공개 저장 중…',
              outcome: '저장 결과 확인 중…',
            }[busy]
          : message}
      </p>
      {!loaded && (
        <Button className="h-10" disabled={!!busy} onClick={() => setLoadAttempt(attempt => attempt + 1)}>
          다시 불러오기
        </Button>
      )}
      {pending && (
        <section className="report-notice rounded-lg border bg-muted" aria-label="미확정 저장 요청">
          <strong>보관된 저장 요청</strong>
          <p>
            동일한 입력을 보관했습니다. 새로고침은 결과만 확인하며 자동으로 저장하지 않습니다. 보관 해제는 서버 취소가
            아닙니다.
          </p>
          <div className="report-toolbar">
            <Button className="h-10" disabled={!!busy} onClick={() => checkOutcome(true)}>
              저장 결과 열기
            </Button>
            <Button variant="outline" className="h-10" disabled={!!busy} onClick={() => checkOutcome(false)}>
              결과 재조회
            </Button>
            <Button variant="outline" className="h-10" disabled={!!busy} onClick={() => send(pending)}>
              동일 요청 다시 보내기
            </Button>
            <Button variant="ghost" className="h-10" disabled={!!busy} onClick={release}>
              보관 해제하고 초안 편집
            </Button>
          </div>
        </section>
      )}
      {loaded && (
        <form
          onSubmit={event => {
            event.preventDefault();
            save();
          }}
          onKeyDown={event => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              save();
            }
          }}
        >
          <div className="report-editor-grid">
            <section className="report-writing rounded-xl border bg-card">
              <label htmlFor="report-title">보고서 제목</label>
              <input
                id="report-title"
                className="report-control rounded-md border bg-background"
                value={title}
                maxLength={200}
                onChange={event => setTitle(event.target.value)}
                disabled={!!busy || !!pending}
              />
              <label htmlFor="report-body">본문</label>
              <textarea
                id="report-body"
                className="report-body rounded-md border bg-background"
                value={body}
                onChange={event => setBody(event.target.value)}
                disabled={!!busy || !!pending}
                placeholder="매출 추이, 주요 원인, 다음 행동을 작성하세요. 입력한 줄바꿈을 그대로 저장합니다."
              />
              <p className="text-sm text-muted-foreground">
                일반 텍스트 · {bytes.toLocaleString()} / 65,536 bytes · Ctrl/⌘ + Enter로 비공개 저장
              </p>
              <div className="report-toolbar">
                <Button
                  type="submit"
                  className="h-10"
                  disabled={
                    !!busy || !!pending || !title.trim() || bytes > 65536 || (!preview && (!saved || selectionChanged))
                  }
                >
                  비공개 저장
                </Button>
                {preview && saved && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    disabled={!!busy || !!pending}
                    onClick={() => {
                      setPreview(null);
                      setKpiId(saved.snapshot.basis.selection.kpiId);
                      setChartId(saved.snapshot.basis.selection.chartId);
                    }}
                  >
                    기존 숫자 유지
                  </Button>
                )}
              </div>
              {saved && !preview && (
                <p className="text-sm text-muted-foreground">
                  제목과 본문만 수정하면 기존 숫자와 계산 기준을 그대로 보존합니다.
                </p>
              )}
            </section>
            <section className="report-results" aria-label="고정 KPI와 차트">
              <div className="report-capture rounded-xl border bg-card">
                <h2>{preview ? '현재 데이터 미리보기' : saved ? '저장 당시의 숫자' : '숫자 선택'}</h2>
                {root && (
                  <div className="report-selectors">
                    <label>
                      KPI
                      <select
                        className="report-control rounded-md border bg-background"
                        value={kpiId}
                        disabled={!!busy || !!pending}
                        onChange={event => {
                          setKpiId(event.target.value);
                          setPreview(null);
                        }}
                      >
                        {root.blocks
                          .filter(block => block.kind === 'BOARD_NUMERIC')
                          .map(block => (
                            <option key={block.id} value={block.id}>
                              {block.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      차트
                      <select
                        className="report-control rounded-md border bg-background"
                        value={chartId}
                        disabled={!!busy || !!pending}
                        onChange={event => {
                          setChartId(event.target.value);
                          setPreview(null);
                        }}
                      >
                        {root.blocks
                          .filter(block => block.kind !== 'BOARD_NUMERIC')
                          .map(block => (
                            <option key={block.id} value={block.id}>
                              {block.title}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  disabled={!!busy || !!pending || !kpiId || !chartId}
                  onClick={calculate}
                >
                  현재 데이터 명시 미리보기
                </Button>
              </div>
              {snapshot ? (
                <>
                  {reportBlocks(snapshot).map(block => (
                    <article key={block.id} className="report-frozen-block rounded-xl border bg-card">
                      <PublishedBlockView block={block} />
                    </article>
                  ))}
                  <section className="report-basis rounded-xl border bg-card">
                    <h2>고정 계산 기준</h2>
                    <dl>
                      <dt>기간</dt>
                      <dd>{snapshot.rendered.periodLabel}</dd>
                      <dt>시간대</dt>
                      <dd>{snapshot.basis.timeZone}</dd>
                      <dt>포착 시각</dt>
                      <dd>{new Date(snapshot.capturedAt).toLocaleString()}</dd>
                      <dt>원본</dt>
                      <dd>
                        저장 Studio #{snapshot.basis.dashboardId} · 소스 #{snapshot.basis.source.id}
                      </dd>
                    </dl>
                    <details>
                      <summary>정의·필터·조건·업무 기준 보기</summary>
                      <pre>{JSON.stringify(snapshot.basis, null, 2)}</pre>
                    </details>
                  </section>
                </>
              ) : (
                <p className="report-empty rounded-xl border text-muted-foreground">
                  KPI와 차트를 선택하고 현재 데이터 미리보기를 실행하세요.
                </p>
              )}
            </section>
          </div>
        </form>
      )}
      {saved && (
        <footer className="report-footer text-muted-foreground">
          <p>
            저장 {new Date(saved.savedAt).toLocaleString()} · r{saved.version}
          </p>
          <code>{saved.revision}</code>
        </footer>
      )}
    </main>
  );
}
