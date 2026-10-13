import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  Alert,
  Box,
  Button,
  Drawer,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { post } from '@/helpers/apiHelper';
import { assistantTransport, AssistantMessage, messageText } from '../assistantTransport';
import { errorMessage, responseData } from '../dashboardPreview';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import { analysisOptions } from '../analysisOptions';
import { timeRangeLabel } from './timeSelection';

export default function DashboardAssistant({
  open,
  onClose,
  dashboardId,
  draft,
  filters,
  dateRange,
  trendGrain = 'auto',
  comparePrevious = false,
  disabled,
  onApplied,
}: any) {
  const mobile = useMediaQuery(useTheme().breakpoints.down('lg'));
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('ask');
  const [selectedWidget, setSelectedWidget] = useState<number | ''>('');
  const [proposal, setProposal] = useState<any>(null);
  const [undo, setUndo] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveConflict, setSaveConflict] = useState(false);
  const [notice, setNotice] = useState('');
  const current = {
    dashboardId,
    databaseId: draft.databaseId,
    currentDraft: draft,
    filters,
    trendGrain,
    comparePrevious,
    ...(dateRange ? { dateRange } : {}),
    ...(selectedWidget !== '' ? { selectedWidget } : {}),
  };
  const context = useRef(current);
  context.current = current;
  const transport = useMemo(() => assistantTransport(() => context.current), []);
  const { messages, sendMessage, status, error, clearError, stop } = useChat<AssistantMessage>({
    id: `dashboard-assistant-${dashboardId}`,
    transport,
    onFinish: ({ message }) => {
      const result = message.metadata?.result;
      if (result?.mode === 'edit') setProposal(result);
    },
  });
  const busy = status === 'submitted' || status === 'streaming';
  const stale = proposal && proposal.base !== JSON.stringify(current);
  const undoStale = undo && undo.after !== JSON.stringify(draft);
  const inputRef = useRef<HTMLInputElement>();
  const scroll = useRef<HTMLDivElement>();
  const savingRef = useRef(false);
  useEffect(() => {
    if (selectedWidget !== '' && selectedWidget >= draft.widgets.length) setSelectedWidget('');
  }, [selectedWidget, draft.widgets.length]);
  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, proposal, open]);

  const send = async () => {
    if (busy || saving || disabled || saveConflict || !input.trim() || input.length > 2000) return;
    const text = input.trim();
    setProposal(null);
    setSaveError('');
    setNotice('');
    clearError();
    setInput('');
    await sendMessage({ text }, { body: { mode } });
  };
  const apply = async (revert = false) => {
    if (
      savingRef.current ||
      busy ||
      disabled ||
      saveConflict ||
      (!revert && (!proposal || stale)) ||
      (revert && (!undo || undoStale))
    )
      return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    const before = draft;
    const next = revert ? undo.before : proposal.preview.draft;
    try {
      const result = responseData(
        await post(
          '/ai/dashboard-save',
          { dashboardId, draft: next, expectedRevision: draft.revision },
          { timeout: 180000 },
        ),
      );
      if (result?.id !== dashboardId) throw new Error('변경을 저장하지 못했습니다.');
      const persisted = { ...next, ...(result.revision ? { revision: result.revision } : {}) };
      setUndo(revert ? null : { before, after: JSON.stringify(persisted) });
      setProposal(null);
      setSelectedWidget('');
      onApplied(persisted);
      setNotice(revert ? '이전 대시보드로 되돌렸습니다.' : '변경을 적용했습니다.');
    } catch (e) {
      if (e?.response?.status === 409) setSaveConflict(true);
      setSaveError(errorMessage(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const close = () => {
    if (!saving) {
      stop();
      onClose();
    }
  };
  return (
    <Drawer
      anchor="right"
      open={open}
      variant={mobile ? 'temporary' : 'persistent'}
      onClose={close}
      ModalProps={{ keepMounted: true }}
      PaperProps={{
        role: mobile ? 'dialog' : 'complementary',
        'aria-label': 'LLM Assistant',
        sx: {
          width: { xs: '100%', lg: 400 },
          top: { xs: 0, lg: 120 },
          height: { xs: '100dvh', lg: 'calc(100dvh - 120px)' },
          minWidth: 0,
          borderLeft: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          backgroundColor: 'background.paper',
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Box>
          <Typography fontWeight={700}>Assistant</Typography>
          <Typography fontSize={12} color="text.secondary">
            현재 대시보드와 함께 분석하기
          </Typography>
        </Box>
        <Button onClick={close} disabled={saving} aria-label="Assistant 닫기">
          닫기
        </Button>
      </Stack>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography fontSize={13} sx={{ overflowWrap: 'anywhere' }}>
          {draft.title}
        </Typography>
        <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
          {dateRange
            ? dateRange.precision === 'timestamp'
              ? timeRangeLabel(dateRange)
              : `${dateRange.start} ~ ${dateRange.end} (${dateRange.timeZone ?? 'UTC'})`
            : '전체 기간'}{' '}
          · {filters.length ? filters.map(f => `${f.column}: ${f.values.map(String).join(', ')}`).join(' · ') : '필터 없음'}
        </Typography>
        <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
          집계 단위: {({ auto: '자동', day: '일별', week: '주별', month: '월별' } as Record<string, string>)[trendGrain]} ·{' '}
          이전 기간 비교: {comparePrevious ? '사용 (적용 기간과 같은 길이)' : '사용 안 함'}
        </Typography>
        <TextField
          select
          size="small"
          fullWidth
          label="분석할 차트"
          value={selectedWidget}
          disabled={busy || saving}
          sx={{ mt: 1.5 }}
          onChange={e => setSelectedWidget(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <MenuItem value="">대시보드 전체</MenuItem>
          {draft.widgets.map((w, i) => (
            <MenuItem key={i} value={i}>
              {w.title}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <Box ref={scroll} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, overflowWrap: 'anywhere' }}>
        {!messages.length && (
          <Stack spacing={1}>
            <Typography fontSize={14}>데이터에 대해 질문하거나 대시보드를 수정해 보세요.</Typography>
            {[
              `${draft.widgets[0]?.title || '주요 지표'}와 범주별 차이를 설명해 줘`,
              '시계열 추세에서 눈에 띄는 변화가 있나요?',
            ].map(text => (
              <Button
                key={text}
                variant="outlined"
                sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none' }}
                onClick={() => {
                  setMode('ask');
                  setInput(text);
                }}
              >
                {text}
              </Button>
            ))}
          </Stack>
        )}
        <Box role="log" aria-label="Assistant 대화" aria-live="polite" aria-relevant="additions text">
          {messages.map(m => (
            <Box
              key={m.id}
              sx={{ mb: 2, p: 1.5, borderRadius: 2, backgroundColor: m.role === 'user' ? '#eff5ff' : '#f5f6f8' }}
            >
              <Typography fontSize={12} fontWeight={700} sx={{ mb: 0.5 }}>
                {m.role === 'user' ? '나' : 'Assistant'}
              </Typography>
              <Typography fontSize={14} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {messageText(m)}
              </Typography>
              {m.metadata?.result?.context && (
                <Box component="details" sx={{ mt: 1 }}>
                  <Typography component="summary" fontSize={12} sx={{ cursor: 'pointer' }}>
                    근거 · SQL · 데이터 범위
                  </Typography>
                  <Box component="pre" sx={{ fontSize: 11, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {JSON.stringify(m.metadata.result.context, null, 2)}
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>
        {busy && (
          <Box role="status">
            <LinearProgress />
            <Typography fontSize={13} sx={{ mt: 1 }}>
              현재 데이터로 답변을 준비하고 있습니다…
            </Typography>
          </Box>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 1 }}>
            {notice}
          </Alert>
        )}
        {proposal && (
          <Stack spacing={1} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
            <Typography fontWeight={700}>변경 미리보기</Typography>
            <Typography fontSize={12}>
              아직 저장되지 않았습니다. 기간·필터는 조회에만 적용하며 저장 SQL에 고정하지 않습니다.
            </Typography>
            {stale && <Alert severity="warning">화면 조건이 바뀌었습니다. 새 미리보기를 요청해 주세요.</Alert>}
            <Typography>{proposal.preview.draft.title}</Typography>
            {proposal.preview.widgets.map((w, i) => (
              <Box
                key={i}
                sx={{
                  minWidth: 0,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  height: w.type === 'BOARD_NUMERIC' ? 150 : 280,
                }}
              >
                <WidgetViewer
                  title={w.title}
                  widgetType={w.type}
                  widgetOption={analysisOptions(w, w.numberNotation || 'compact')}
                  dataSet={w.datas}
                />
              </Box>
            ))}
            <Box component="details">
              <Typography component="summary" fontSize={12} sx={{ cursor: 'pointer' }}>
                변경 SQL · 계산식
              </Typography>
              {proposal.preview.widgets.map((w, i) => (
                <Box component="pre" key={i} sx={{ fontSize: 11, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {w.title}
                  {'\n'}
                  {w.sql}
                </Box>
              ))}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={busy || saving || stale || disabled || saveConflict}
                onClick={() => apply()}
              >
                변경 적용
              </Button>
              <Button disabled={saving} onClick={() => setProposal(null)}>
                미리보기 취소
              </Button>
            </Stack>
          </Stack>
        )}
        {undo && (
          <Button
            sx={{ mt: 1 }}
            disabled={busy || saving || disabled || undoStale || saveConflict}
            onClick={() => apply(true)}
          >
            이전 변경 되돌리기
          </Button>
        )}
      </Box>
      <Box
        component="form"
        onSubmit={e => {
          e.preventDefault();
          void send();
        }}
        sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}
      >
        {(error || saveError) && (
          <Alert severity="error" sx={{ mb: 1, overflowWrap: 'anywhere' }}>
            {saveError || error?.message}
            {saveConflict && <Button onClick={() => window.location.reload()}>최신 화면 불러오기</Button>}
          </Alert>
        )}
        {disabled && (
          <Alert severity="info" sx={{ mb: 1 }}>
            화면 조회를 완료한 뒤 질문할 수 있습니다.
          </Alert>
        )}
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button
            aria-pressed={mode === 'ask'}
            variant={mode === 'ask' ? 'contained' : 'outlined'}
            disabled={busy || saving}
            onClick={() => setMode('ask')}
          >
            질문
          </Button>
          <Button
            aria-pressed={mode === 'edit'}
            variant={mode === 'edit' ? 'contained' : 'outlined'}
            disabled={busy || saving}
            onClick={() => setMode('edit')}
          >
            대시보드 수정
          </Button>
        </Stack>
        <TextField
          inputRef={inputRef}
          label={mode === 'ask' ? '데이터에 질문하기' : '대시보드 수정 요청'}
          fullWidth
          multiline
          minRows={2}
          maxRows={5}
          value={input}
          disabled={busy || saving}
          inputProps={{ maxLength: 2000 }}
          onChange={e => setInput(e.target.value)}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
          <Typography fontSize={11} color="text.secondary">
            대화는 현재 화면에서만 유지됩니다.
          </Typography>
          {busy ? (
            <Button onClick={() => stop()}>응답 중단</Button>
          ) : (
            <Button type="submit" variant="contained" disabled={saving || disabled || saveConflict || !input.trim()}>
              {saving ? '저장 중…' : mode === 'edit' ? '미리보기 요청' : '보내기'}
            </Button>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
