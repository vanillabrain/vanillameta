import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { get, post } from '@/helpers/apiHelper';
import { AnalysisUiProvider, analysisFieldSx, analysisPanelSx } from '@/components/analysis/AnalysisUi';
import { errorMessage, responseData } from '../Dashboard/dashboardPreview';
import SnapshotView, { Snapshot } from './SnapshotView';

type Published = {
  uuid: string;
  version: number;
  active: boolean;
  publishedAt: string;
  expiresAt: string;
  dashboardRevision: string;
};
type State = { dashboardId: number; revision: string; version: number; publication: Published | null };
type Preview = { dashboardId: number; revision: string; ticket: string; snapshot: Snapshot };
const defaultExpiry = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
export function expiryInstant(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const instant = `${date}T23:59:59.999Z`;
  const time = Date.parse(instant);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) return null;
  return time > Date.now() && time <= Date.now() + 30 * 86400000 ? instant : null;
}
const validState = (value: State, id: string) =>
  value?.dashboardId === Number(id) &&
  /^[a-f0-9]{64}$/.test(value.revision) &&
  Number.isSafeInteger(value.version) &&
  value.version >= 0;

function PublicationContent() {
  const { dashboardId = '' } = useParams();
  const base = `/bi/dashboards/${encodeURIComponent(dashboardId)}/publication`;
  const [state, setState] = useState<State | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState<any>(null);
  const [uncertain, setUncertain] = useState(false);
  const sequence = useRef(0);
  const pending = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    sequence.current += 1;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    pending.current = true;
    setBusy('게시 상태 확인 중…');
    setState(null);
    setPreview(null);
    setError('');
    setNotice('');
    setRetry(null);
    setUncertain(false);
    get(base, undefined, { signal: abort.signal })
      .then(response => {
        if (token !== sequence.current) return;
        const value = responseData(response);
        if (!validState(value, dashboardId)) throw new Error('게시 상태를 확인할 수 없습니다.');
        setState(value);
      })
      .catch(failure => {
        if (token === sequence.current) setError(errorMessage(failure));
      })
      .finally(() => {
        if (token === sequence.current) {
          setBusy('');
          pending.current = false;
        }
      });
    return () => {
      sequence.current += 1;
      abort.abort();
      request.current?.abort();
      pending.current = false;
    };
  }, [base, dashboardId]);

  const perform = async (kind: 'check' | 'preview' | 'publish' | 'retry' | 'revoke') => {
    if (pending.current || (kind !== 'check' && !state)) return;
    if (kind === 'publish' && (!preview || !expiryInstant(expiry) || uncertain)) return;
    pending.current = true;
    const token = sequence.current;
    const abort = new AbortController();
    request.current = abort;
    setBusy(
      {
        check: '게시 상태 확인 중…',
        preview: '게시 결과 확인 중…',
        publish: '게시 중…',
        retry: '같은 게시 요청 확인 중…',
        revoke: '게시 중지 중…',
      }[kind],
    );
    setError('');
    setNotice('');
    let body: any;
    let dispatched = false;
    try {
      if (kind === 'check') {
        const value = responseData(await get(base, undefined, { signal: abort.signal }));
        if (token !== sequence.current) return;
        if (!validState(value, dashboardId)) throw new Error('게시 상태를 확인할 수 없습니다.');
        setState(value);
        setPreview(null);
        setUncertain(false);
        setNotice('게시 상태를 확인했습니다. 새 게시에는 미리보기가 필요합니다.');
      } else if (kind === 'preview') {
        setPreview(null);
        setRetry(null);
        const value = responseData(
          await post(`${base}/preview`, { expectedRevision: state.revision }, { signal: abort.signal, timeout: 120000 }),
        );
        if (token !== sequence.current) return;
        if (
          value?.dashboardId !== state.dashboardId ||
          value.revision !== state.revision ||
          !value.ticket ||
          !Array.isArray(value.snapshot?.widgets)
        )
          throw new Error('게시 미리보기를 확인할 수 없습니다.');
        setPreview(value);
        setNotice('전체 기간의 고정 집계 결과입니다. 아래 결과와 공개 범위를 확인한 뒤 게시하세요.');
      } else {
        if (kind === 'retry' && !retry) return;
        body =
          kind === 'revoke'
            ? { expectedVersion: state.version }
            : kind === 'retry'
            ? retry
            : {
                expectedRevision: preview.revision,
                expectedVersion: state.version,
                ticket: preview.ticket,
                requestId: crypto.randomUUID(),
                expiresAt: expiryInstant(expiry),
                visibility: 'link',
              };
        if (kind !== 'revoke') setRetry(body);
        dispatched = true;
        const value = responseData(await post(kind === 'revoke' ? `${base}/revoke` : base, body, { signal: abort.signal }));
        if (token !== sequence.current) return;
        if (!validState(value, dashboardId)) throw new Error('게시 응답을 확인할 수 없습니다.');
        setState(value);
        setPreview(null);
        setRetry(null);
        setUncertain(false);
        setNotice(
          kind === 'revoke'
            ? '게시를 중지했습니다. 이후 링크 조회가 차단됩니다.'
            : `게시 버전 ${value.version}을 저장했습니다.`,
        );
      }
    } catch (failure) {
      if (token !== sequence.current) return;
      const status = (failure as any)?.response?.status;
      if (kind === 'publish' || kind === 'retry' || kind === 'revoke') {
        if (!dispatched) {
          setError(
            '게시 요청을 만들지 못했습니다. HTTPS 또는 localhost에서 다시 실행해 주세요. 저장과 게시는 변경하지 않았습니다.',
          );
        } else if (!status || status >= 500) {
          setUncertain(true);
          setError(
            '게시 결과가 확실하지 않습니다. 상태를 확인하거나 같은 게시 요청을 다시 확인하세요. 저장 분석은 유지됩니다.',
          );
        } else {
          setPreview(null);
          setRetry(null);
          setUncertain(status !== 400);
          setError(
            status === 409
              ? '저장 또는 게시 버전이 변경됐습니다. 상태 확인 후 미리보기를 다시 실행하세요.'
              : errorMessage(failure),
          );
        }
      } else setError(errorMessage(failure));
    } finally {
      if (token === sequence.current) {
        pending.current = false;
        setBusy('');
      }
    }
  };
  const published = state?.publication;
  const activeLink = published?.active && Date.parse(published.expiresAt) > Date.now();
  return (
    <Box
      component="main"
      sx={{ p: { xs: 2, sm: 3 }, minWidth: 0, maxWidth: 1600, width: '100%', boxSizing: 'border-box', mx: 'auto' }}
    >
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography component="h1" sx={{ fontSize: 20, fontWeight: 600, mr: 'auto' }}>
          게시 버전
        </Typography>
        <Button component={Link} to={`/dashboard/${dashboardId}`} disabled={!!busy}>
          저장 화면으로
        </Button>
        <Button variant="outlined" disabled={!!busy} onClick={() => void perform('check')}>
          게시 상태 확인
        </Button>
      </Stack>
      <Box sx={analysisPanelSx}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>링크를 가진 사람이 보는 고정된 집계 결과</Typography>
        <Typography sx={{ my: 1, fontSize: 12 }}>
          전체 기간 · 필터 없음 · UTC. 현재 화면에서 선택한 기간·필터는 포함하지 않습니다. 원본 행은 제공하지 않습니다.
          중지·만료 후 다시 게시하면 새 링크가 발급됩니다.
        </Typography>
        <Typography sx={{ fontSize: 12 }}>
          {published
            ? `${
                published.active && Date.parse(published.expiresAt) > Date.now() ? '게시 중' : '게시 중지 또는 만료'
              } · 버전 ${published.version} · 게시 ${published.publishedAt} · 만료 ${published.expiresAt}`
            : '아직 게시한 버전이 없습니다.'}
        </Typography>
        {published && state.revision !== published.dashboardRevision && (
          <Alert severity="info" sx={{ my: 1 }}>
            저장 분석이 게시본과 다릅니다. 재게시 전까지 기존 게시 결과가 유지됩니다.
          </Alert>
        )}
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} alignItems="center" sx={{ mt: 2 }}>
          <TextField
            label="만료일 (UTC)"
            type="date"
            size="small"
            value={expiry}
            onChange={event => {
              setExpiry(event.target.value);
              setRetry(null);
            }}
            disabled={!!busy || uncertain}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ ...analysisFieldSx, width: 168 }}
          />
          <Button variant="outlined" disabled={!!busy || !state || uncertain} onClick={() => void perform('preview')}>
            게시 결과 미리보기
          </Button>
          <Button
            variant="contained"
            disabled={!!busy || !preview || !expiryInstant(expiry) || uncertain}
            onClick={() => void perform('publish')}
          >
            {published ? '이 결과로 재게시' : '링크 게시'}
          </Button>
          {published?.active && (
            <Button variant="outlined" disabled={!!busy || uncertain} onClick={() => void perform('revoke')}>
              게시 중지
            </Button>
          )}
          {uncertain && retry && (
            <Button variant="outlined" disabled={!!busy} onClick={() => void perform('retry')}>
              같은 게시 요청 다시 확인
            </Button>
          )}
        </Stack>
        {activeLink && (
          <TextField
            label="게시 링크"
            value={`${window.location.origin}/published/${published.uuid}`}
            fullWidth
            size="small"
            slotProps={{ input: { readOnly: true } }}
            sx={{ ...analysisFieldSx, mt: 2 }}
          />
        )}
        {activeLink && (
          <Button
            component="a"
            href={`/published/${published.uuid}`}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ mt: 1 }}
          >
            게시된 결과 열기
          </Button>
        )}
      </Box>
      {busy && (
        <Typography role="status" sx={{ my: 1, fontSize: 12 }}>
          {busy}
        </Typography>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {notice && (
        <Typography role="status" sx={{ my: 2, fontSize: 12 }}>
          {notice}
        </Typography>
      )}
      {preview && <SnapshotView snapshot={preview.snapshot} />}
    </Box>
  );
}
export default function Publication() {
  return (
    <AnalysisUiProvider>
      <PublicationContent />
    </AnalysisUiProvider>
  );
}
