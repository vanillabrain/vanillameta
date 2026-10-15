import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Checkbox,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material';
import { studioRequestId } from './studioApi';
import {
  fetchOwnerPublication,
  Publication,
  PublicationRequest,
  publicationError,
  publicationTime,
  publicationUrl,
  publishDashboard,
  revokePublication,
} from './studioPublication';

type Props = { open: boolean; onClose: () => void; dashboardId: number; revision: string; dirty: boolean };
export default function StudioPublish({ open, onClose, dashboardId, revision, dirty }: Props) {
  const [current, setCurrent] = useState<Publication | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'link'>('private');
  const [expiry, setExpiry] = useState('');
  const [allowRemix, setAllowRemix] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revokeConfirm, setRevokeConfirm] = useState(false);
  const pending = useRef<PublicationRequest | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setReady(false);
    setError('');
    setNotice('');
    setRevokeConfirm(false);
    fetchOwnerPublication(dashboardId)
      .then(value => {
        if (!active) return;
        setCurrent(value);
        setReady(true);
        if (!pending.current) {
          setVisibility(value?.visibility ?? 'private');
          setAllowRemix(value?.allowRemix ?? false);
          const date = value?.expiresAt ? new Date(value.expiresAt) : null;
          setExpiry(date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
        }
      })
      .catch(cause => {
        if (active) setError(publicationError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, dashboardId, reload]);
  const publish = async () => {
    if (busy || dirty) return;
    if (!pending.current) {
      if (expiry && (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())) {
        setError('만료 시각은 현재보다 이후로 선택해 주세요.');
        return;
      }
      pending.current = {
        requestId: studioRequestId(),
        expectedRevision: revision,
        visibility,
        allowRemix,
        ...(expiry ? { expiresAt: new Date(expiry).toISOString() } : {}),
      };
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const value = await publishDashboard(dashboardId, pending.current);
      pending.current = null;
      if (value.revokedAt) {
        setCurrent(null);
        setError('이 요청으로 게시한 링크는 이미 중지되었습니다. 새 링크가 필요하면 게시하기를 다시 눌러 주세요.');
        return;
      }
      // A replay receipt may predate another tab's republish. Refresh the stable link.
      let latest: Publication | null;
      try {
        latest = await fetchOwnerPublication(dashboardId);
      } catch {
        setCurrent(null);
        setReady(false);
        setError('게시 요청은 완료됐습니다. 최신 공개 범위를 확인하지 못했으니 게시 상태를 다시 확인해 주세요.');
        return;
      }
      if (!latest || latest.revokedAt) {
        setCurrent(null);
        setError('게시 요청은 처리됐지만 현재 게시본은 중지되었습니다. 새 링크가 필요하면 다시 게시해 주세요.');
        return;
      }
      setCurrent(latest);
      setVisibility(latest.visibility);
      setAllowRemix(latest.allowRemix);
      setNotice(
        latest.token === value.token && latest.version === value.version
          ? '버전 ' + latest.version + ' 게시 완료. 이 시점의 집계 결과를 링크에서 볼 수 있습니다.'
          : '게시 요청은 처리되었습니다. 이후 변경된 최신 게시본(버전 ' + latest.version + ')의 공개 범위를 표시합니다.',
      );
    } catch (cause: any) {
      if (cause?.response?.status && cause.response.status < 500) pending.current = null;
      setError(publicationError(cause));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    if (!current || busy) return;
    setBusy(true);
    setError('');
    try {
      await revokePublication(current.token);
      setCurrent(null);
      pending.current = null;
      setRevokeConfirm(false);
      setNotice('게시를 중지했습니다. 이 링크로는 더 이상 데이터를 조회할 수 없습니다.');
    } catch (cause) {
      setError(publicationError(cause));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(publicationUrl(current.token));
      setNotice('링크를 복사했습니다.');
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setNotice('자동 복사가 지원되지 않습니다. 선택된 링크를 직접 복사해 주세요.');
    }
  };
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      fullWidth
      maxWidth="sm"
      className="studio-publication-dialog"
      aria-labelledby="studio-publish-heading"
    >
      <DialogTitle id="studio-publish-heading">게시·공유</DialogTitle>
      <DialogContent>
        <p className="studio-publish-intro">
          저장한 대시보드를 읽기 전용으로 게시합니다. 초안을 편집해도 게시본은 그대로이며, 재게시할 때만 갱신됩니다.
        </p>
        {dirty && (
          <Alert severity="warning">
            저장되지 않은 변경이 있습니다. 닫고 먼저 저장한 뒤 게시해 주세요. 기존 게시본은 유지됩니다.
          </Alert>
        )}
        {loading && <p role="status">게시 상태 확인 중…</p>}
        {!loading && !ready && <Button onClick={() => setReload(value => value + 1)}>게시 상태 다시 확인</Button>}
        {error && <Alert severity="error">{error}</Alert>}
        {notice && (
          <Alert severity="success" role="status">
            {notice}
          </Alert>
        )}
        {current && (
          <section className="studio-publish-current" aria-label="현재 게시본">
            <div className="studio-publish-meta">
              <strong>버전 {current.version}</strong>
              <span>{current.visibility === 'link' ? '링크가 있는 모든 사람' : '비공개 · 소유자만'}</span>
            </div>
            <p>집계 시각 {publicationTime(current.asOf)}</p>
            <p>만료 {current.expiresAt ? publicationTime(current.expiresAt) : '설정하지 않음'}</p>
            <div className="studio-publish-link">
              <TextField
                inputRef={linkInput}
                label="게시 링크"
                value={publicationUrl(current.token)}
                slotProps={{ input: { readOnly: true } }}
                fullWidth
                size="small"
              />
              <Button variant="outlined" onClick={copy}>
                링크 복사
              </Button>
            </div>
            <Button component="a" href={publicationUrl(current.token)} target="_blank" rel="noopener noreferrer">
              게시본 열기
            </Button>
          </section>
        )}
        <fieldset className="studio-publish-settings" disabled={loading || busy || !!pending.current}>
          <legend>다음 게시본의 공개 범위</legend>
          <RadioGroup value={visibility} onChange={e => setVisibility(e.target.value as 'private' | 'link')}>
            <FormControlLabel value="private" control={<Radio />} label="비공개 · 로그인한 소유자만 조회" />
            <FormControlLabel value="link" control={<Radio />} label="링크 공개 · 링크가 있는 모든 사람이 조회" />
          </RadioGroup>
          <FormControlLabel
            control={<Checkbox checked={allowRemix} onChange={event => setAllowRemix(event.target.checked)} />}
            label="내 데이터로 복제 허용"
          />
          <p className="studio-publish-note">
            허용하면 원본 열 이름과 지표 정의를 재사용할 수 있습니다. 원본 행·연결 정보·SQL은 공유하지 않습니다. 새 복제본은
            비공개로 생성됩니다.
          </p>
          <TextField
            type="datetime-local"
            label="링크 만료 시각 (내 시간대)"
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
            size="small"
            helperText="비워 두면 자동 만료되지 않습니다. 만료 여부는 서버에서 확인합니다."
          />
        </fieldset>
        <p className="studio-publish-note">
          원본 행·연결 정보·SQL은 공유하지 않습니다. 이미 본 화면이나 다운로드는 회수할 수 없습니다.
        </p>
        {revokeConfirm && (
          <Alert severity="warning">
            링크 전체를 중지할까요? 다시 게시하면 새 링크가 만들어집니다.
            <div>
              <Button color="error" onClick={revoke} disabled={busy}>
                중지 확인
              </Button>
              <Button onClick={() => setRevokeConfirm(false)} disabled={busy}>
                유지
              </Button>
            </div>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {current && (
          <Button color="error" onClick={() => setRevokeConfirm(true)} disabled={busy || loading}>
            게시 중지
          </Button>
        )}
        <Button onClick={onClose} disabled={busy}>
          닫기
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={publish}
          disabled={busy || loading || !ready || dirty || !revision}
        >
          {busy ? '처리 중…' : pending.current ? '같은 요청 재시도' : current ? '재게시' : '게시하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
