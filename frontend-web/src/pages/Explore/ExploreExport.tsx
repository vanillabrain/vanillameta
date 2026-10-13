import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { post } from '@/helpers/apiHelper';

type Props = { payload: { mode: 'explore' | 'pivot'; query: Record<string, unknown> }; disabled: boolean };

export default function ExploreExport({ payload, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const key = JSON.stringify(payload);
  useEffect(() => {
    generation.current += 1;
    controller.current?.abort();
    setBusy(false);
    setNotice('');
    setError('');
    return () => {
      generation.current += 1;
      controller.current?.abort();
    };
  }, [key, disabled]);

  const download = async () => {
    if (busy || disabled) return;
    generation.current += 1;
    const token = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const response = await post('/bi/explore/export', payload, { signal: abort.signal });
      if (token !== generation.current || abort.signal.aborted) return;
      const data = response?.data?.data;
      if (response?.data?.status !== 'SUCCESS') throw new Error('invalid export response');
      if (data?.sourceRevision !== payload.query.sourceRevision)
        throw Object.assign(new Error('source revision changed'), { response: { status: 409 } });
      if (
        typeof data.csv !== 'string' ||
        !/^[a-zA-Z0-9_-]+\.csv$/.test(data.filename) ||
        data.mimeType !== 'text/csv;charset=utf-8' ||
        !Number.isInteger(data.rowCount) ||
        data.rowCount < 0 ||
        data.rowCount > 10000
      )
        throw new Error('invalid CSV response');
      const blob = new Blob([data.csv], { type: data.mimeType });
      if (blob.size > 2097152 || blob.size !== data.bytes) throw new Error('invalid CSV size');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      try {
        link.href = url;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setNotice(`${data.rowCount.toLocaleString()}행 CSV 다운로드를 시작했습니다.`);
    } catch (err: any) {
      if (token !== generation.current || abort.signal.aborted) return;
      const status = err?.response?.status;
      const body = err?.response?.data;
      const detail = body?.data;
      const message = typeof detail === 'string' ? detail : detail?.message ?? body?.message;
      setError(
        status === 409
          ? '데이터 버전이 변경되었습니다. 카탈로그를 다시 불러온 뒤 내보내세요.'
          : typeof message === 'string'
          ? message
          : 'CSV를 내보내지 못했습니다. 조건을 확인하고 다시 시도해 주세요.',
      );
    } finally {
      if (token === generation.current) setBusy(false);
    }
  };

  return (
    <Box>
      <Button aria-expanded={open} onClick={() => setOpen(value => !value)} sx={{ textTransform: 'none' }}>
        내보내기 ▾
      </Button>
      {open && (
        <Stack spacing={1} sx={{ mt: 1, p: 1.5, border: '1px solid #e2e8f0', borderRadius: 1 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            현재 지표·축·필터·기간·비교의 집계 결과를 CSV로 저장합니다. 지표별 행 형식이며 원본 전체 행은 포함하지 않습니다.
            탐색 차원 순위는 화면과 같은 상위 20개입니다. 최대 10,000행 / 2MB.
          </Typography>
          <Button disabled={disabled || busy} onClick={download}>
            {busy ? 'CSV 준비 중…' : 'CSV 다운로드'}
          </Button>
          {disabled && <Typography sx={{ fontSize: 12 }}>유효한 결과를 불러온 뒤 내보내세요.</Typography>}
        </Stack>
      )}
      {notice && (
        <Typography role="status" sx={{ fontSize: 12 }}>
          {notice}
        </Typography>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  );
}
