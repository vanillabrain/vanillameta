import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TextField } from '@/components/ui/text-field';
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

type Props = {
  open: boolean;
  onClose: () => void;
  dashboardId: number;
  revision: string;
  dirty: boolean;
  targetLabel?: string;
};
export default function StudioPublish({ open, onClose, dashboardId, revision, dirty, targetLabel }: Props) {
  const controlId = useId();
  const returnFocus = useRef<HTMLElement | null>(null);
  const [current, setCurrent] = useState<Publication | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'link'>('private');
  const [expiry, setExpiry] = useState('');
  const [allowRemix, setAllowRemix] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflicted, setConflicted] = useState(false);
  useEffect(() => {
    setConflicted(false);
    setError('');
  }, [dashboardId, revision]);
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
    if (busy || dirty || conflicted || loading || !ready) return;
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
      // UC038: a publication status read cannot approve a newer saved document.
      if (cause?.response?.status === 409) setConflicted(true);
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
  const settingsLocked = loading || busy || !!pending.current;
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        className="studio-publication-dialog flex max-h-[calc(100dvh_-_2rem)] max-w-[calc(100vw_-_2rem)] flex-col sm:max-w-xl"
        showCloseButton={false}
        aria-labelledby="studio-publish-heading"
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}
        onEscapeKeyDown={event => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle id="studio-publish-heading">게시·공유</DialogTitle>
          <DialogDescription className="studio-publish-intro">
            저장한 대시보드를 읽기 전용으로 게시합니다. 초안을 편집해도 게시본은 그대로이며, 재게시할 때만 갱신됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {targetLabel && (
            <p className="text-sm font-medium" role="status">
              {targetLabel}
            </p>
          )}
          {dirty && (
            <Notice severity="warning">
              저장되지 않은 변경이 있습니다. 닫고 먼저 저장한 뒤 게시해 주세요. 기존 게시본은 유지됩니다.
            </Notice>
          )}
          {loading && <p role="status">게시 상태 확인 중…</p>}
          {!loading && !ready && (
            <Button variant="outline" onClick={() => setReload(value => value + 1)}>
              게시 상태 다시 확인
            </Button>
          )}
          {(error || conflicted) && (
            <Notice severity={conflicted ? 'warning' : 'error'}>
              {conflicted
                ? '저장본이 변경되어 이 버전의 게시를 멈췄습니다. 최신 화면에서 제목·수치·차트를 확인한 뒤 다시 게시하세요.'
                : error}
              {conflicted && (
                <>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <a href={'/dashboard/' + dashboardId + '/studio'} target="_blank" rel="noopener noreferrer">
                        최신 저장본 확인
                      </a>
                    </Button>
                  </div>
                  <p className="mt-2 text-xs">새 탭에서 열립니다. 현재 편집과 기존 게시본은 유지됩니다.</p>
                </>
              )}
            </Notice>
          )}
          {notice && (
            <Notice severity="success" role="status">
              {notice}
            </Notice>
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
                  readOnly
                  className="w-full flex-1 basis-full sm:basis-0"
                />
                <Button variant="outline" onClick={copy}>
                  링크 복사
                </Button>
              </div>
              <Button asChild variant="ghost">
                <a href={publicationUrl(current.token)} target="_blank" rel="noopener noreferrer">
                  게시본 열기
                </a>
              </Button>
            </section>
          )}
          <fieldset className="studio-publish-settings flex flex-col gap-4" disabled={settingsLocked}>
            <legend>다음 게시본의 공개 범위</legend>
            <RadioGroup
              aria-label="다음 게시본의 공개 범위"
              value={visibility}
              disabled={settingsLocked}
              onValueChange={value => setVisibility(value as 'private' | 'link')}
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem id={controlId + '-private'} value="private" className="mt-0.5" />
                <Label htmlFor={controlId + '-private'} className="leading-5">
                  비공개 · 로그인한 소유자만 조회
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem id={controlId + '-link'} value="link" className="mt-0.5" />
                <Label htmlFor={controlId + '-link'} className="leading-5">
                  링크 공개 · 링크가 있는 모든 사람이 조회
                </Label>
              </div>
            </RadioGroup>
            <div className="flex items-start gap-2">
              <Checkbox
                id={controlId + '-remix'}
                className="mt-0.5"
                checked={allowRemix}
                disabled={settingsLocked}
                onCheckedChange={checked => setAllowRemix(checked === true)}
              />
              <Label htmlFor={controlId + '-remix'} className="leading-5">
                내 데이터로 복제 허용
              </Label>
            </div>
            <p className="studio-publish-note">
              허용하면 원본 열 이름과 지표 정의를 재사용할 수 있습니다. 원본 행·연결 정보·SQL은 공유하지 않습니다. 새
              복제본은 비공개로 생성됩니다.
            </p>
            <TextField
              type="datetime-local"
              label="링크 만료 시각 (내 시간대)"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              helperText="비워 두면 자동 만료되지 않습니다. 만료 여부는 서버에서 확인합니다."
            />
          </fieldset>
          <p className="studio-publish-note">
            원본 행·연결 정보·SQL은 공유하지 않습니다. 이미 본 화면이나 다운로드는 회수할 수 없습니다.
          </p>
          {revokeConfirm && (
            <Notice severity="warning">
              링크 전체를 중지할까요? 다시 게시하면 새 링크가 만들어집니다.
              <div>
                <Button variant="destructive" onClick={revoke} disabled={busy}>
                  중지 확인
                </Button>
                <Button variant="ghost" onClick={() => setRevokeConfirm(false)} disabled={busy}>
                  유지
                </Button>
              </div>
            </Notice>
          )}
        </div>
        <DialogFooter className="shrink-0 flex-wrap">
          {current && (
            <Button variant="destructive" onClick={() => setRevokeConfirm(true)} disabled={busy || loading}>
              게시 중지
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          <Button onClick={publish} disabled={busy || loading || !ready || dirty || conflicted || !revision}>
            {busy ? '처리 중…' : pending.current ? '같은 요청 재시도' : current ? '재게시' : '게시하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
