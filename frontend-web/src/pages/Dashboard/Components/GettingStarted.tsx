import React, { useRef, useState } from 'react';
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { post } from '@/helpers/apiHelper';

export default function GettingStarted({ returning = false }: { returning?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const openSample = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await post('/commerce/sample', {}, { timeout: 300000 });
      const result = response.data;
      if (result.status !== 'SUCCESS' || !Number.isInteger(result.data?.projectId) || result.data.projectId <= 0)
        throw new Error('invalid sample response');
      navigate(`/commerce/${result.data.projectId}?sample=1`);
    } catch {
      setError(
        '샘플을 준비하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요. 내 파일 연결은 계속 사용할 수 있습니다.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Box component="section" aria-labelledby="getting-started-title" sx={{ mb: 3 }}>
      <Typography id="getting-started-title" component="h2" variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        {returning ? '새로운 분석을 시작해 볼까요?' : '어떤 데이터를 분석해 볼까요?'}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        샘플로 살펴보거나 내 데이터를 연결해 보세요. AI 설정 없이도 시작할 수 있습니다.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Card variant="outlined" sx={{ p: 2.5, flex: 1, minWidth: 0 }}>
          <Typography component="h3" variant="h6">
            매출·환불 샘플
          </Typography>
          <Typography sx={{ my: 1.5 }}>37개 주문의 결제·환불 추이와 채널별 성과를 둘러보세요.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Analytics Engineering 합성 데이터 일부 · CC BY 4.0 · USD/UTC. 실제 고객 매출이 아닙니다.
          </Typography>
          <Button variant="contained" onClick={openSample} aria-disabled={busy} sx={{ minHeight: 44 }}>
            {busy ? '샘플 준비 중…' : '샘플 대시보드 보기'}
          </Button>
          <Typography role="status" aria-live="polite" variant="body2" sx={{ mt: 1 }}>
            {busy ? '데이터를 확인하고 저장하고 있습니다. 잠시 기다려 주세요.' : '다시 열면 저장된 샘플을 사용합니다.'}
          </Typography>
        </Card>
        <Card variant="outlined" sx={{ p: 2.5, flex: 1, minWidth: 0 }}>
          <Typography component="h3" variant="h6">
            내 파일로 시작
          </Typography>
          <Typography sx={{ my: 1.5 }}>매출·환불은 주문·결제·환불 CSV를 준비하세요. 고객 CSV는 선택입니다.</Typography>
          <Stack spacing={1} alignItems="flex-start">
            <Button variant="outlined" onClick={() => navigate('/commerce?import=1')} sx={{ minHeight: 44 }}>
              매출·환불 파일 연결
            </Button>
            <Button onClick={() => navigate('/data/file')} sx={{ minHeight: 44 }}>
              일반 CSV·JSON·Parquet 분석
            </Button>
          </Stack>
        </Card>
        <Card variant="outlined" sx={{ p: 2.5, flex: 1, minWidth: 0 }}>
          <Typography component="h3" variant="h6">
            데이터베이스 연결
          </Typography>
          <Typography sx={{ my: 1.5 }}>
            기존 연결 설정과 연결 테스트를 이용합니다. 종류별로 서버·드라이버 설정이 필요합니다.
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/data')} sx={{ minHeight: 44 }}>
            데이터 연결 관리
          </Button>
        </Card>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2, overflowWrap: 'anywhere' }}>
          {error}
          <Button onClick={openSample} aria-disabled={busy} sx={{ minHeight: 44 }}>
            샘플 다시 시도
          </Button>
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        데이터 연결 → 데이터 확인 → 지표·차트 → 대시보드 저장
      </Typography>
    </Box>
  );
}
