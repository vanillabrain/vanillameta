import React, { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography } from '@mui/material';
import { get, post } from '@/helpers/apiHelper';
export default function PivotDashboardAdd({
  sourceId,
  viewId,
  name,
}: {
  sourceId: number;
  viewId: number | string;
  name: string;
}) {
  const [open, setOpen] = useState(false),
    [dashboards, setDashboards] = useState<any[]>([]),
    [id, setId] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setId('');
    setError('');
    setDashboards([]);
    setBusy(true);
    get('/dashboard', undefined, { signal: abort.signal })
      .then(r => {
        if (r.data.status !== 'SUCCESS') throw new Error();
        if (!abort.signal.aborted)
          setDashboards(
            r.data.data.filter((d: any) => {
              try {
                return JSON.parse(d.analysisDefinition ?? '{}').databaseId === sourceId;
              } catch {
                return false;
              }
            }),
          );
      })
      .catch(() => {
        if (!abort.signal.aborted) setError('대시보드 목록을 불러오지 못했습니다. 다시 열어 주세요.');
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [open]);
  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await post(`/bi/dashboard/${id}/pivots`, { sourceId, viewId });
      if (r.data.status !== 'SUCCESS') throw new Error();
      setNotice('대시보드에 Pivot을 추가했습니다.');
      setOpen(false);
    } catch (e: any) {
      setError(
        e.response?.data?.data?.message || e.response?.data?.message || 'Pivot을 추가하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button aria-label={`${name} 대시보드에 추가`} onClick={() => setOpen(true)}>
        대시보드에 추가
      </Button>
      <Typography role="status" variant="caption">
        {notice}
      </Typography>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="pivot-add-title"
      >
        <DialogTitle id="pivot-add-title">저장한 Pivot을 대시보드에 추가</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            같은 데이터 소스의 분석 대시보드를 선택하세요. 행·열·지표와 기본 필터를 복사하고 대시보드 공통 필터·기간을
            연결합니다.
          </Typography>
          <TextField
            autoFocus
            select
            fullWidth
            size="small"
            label="추가할 대시보드"
            value={id}
            disabled={busy}
            onChange={e => setId(e.target.value)}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            <option value="">대시보드를 선택하세요</option>
            {dashboards.map(d => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </TextField>
          {!busy && !dashboards.length && <Typography sx={{ mt: 1 }}>추가할 대시보드가 없습니다.</Typography>}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, '& button': { minHeight: 40 } }}>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button variant="contained" disabled={busy || !id} onClick={() => void add()}>
            {busy ? '추가 중…' : 'Pivot 추가'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
