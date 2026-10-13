import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { post } from '@/helpers/apiHelper';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMPORT_ERROR_CODES = ['IMPORT_INVALID_DATE', 'IMPORT_MISSING_COLUMNS'] as const;
const RESELECT_FILES = 'reselect-files';
const EXPLANATION_MAX = 1000;
const HELP_ERROR = 'AI 오류 설명을 가져오지 못했습니다. 아래 파일 선택으로 CSV를 다시 고른 뒤 가져오기를 시도해 주세요.';

export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[number];
export type ImportDiagnostic = { requestId: string; errorCode: ImportErrorCode };

const plainText = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
};

const envelopeOf = (error: unknown): Record<string, unknown> | undefined => {
  const body = (error as { response?: { data?: unknown } })?.response?.data as Record<string, unknown> | undefined;
  return (body?.data ?? body) as Record<string, unknown> | undefined;
};

// Only a server-validated import diagnostic unlocks the opt-in button. The request carries
// nothing but requestId, so raw messages, rowIds, file names and rows never leave the page.
export const parseImportDiagnostic = (error: unknown): ImportDiagnostic | null => {
  const diagnostic = envelopeOf(error)?.diagnostic;
  if (!diagnostic || typeof diagnostic !== 'object') return null;
  const { requestId, errorCode, stage, version, target, dataHealth } = diagnostic as Record<string, unknown>;
  if (typeof requestId !== 'string' || !UUID_V4_PATTERN.test(requestId)) return null;
  if (typeof errorCode !== 'string' || !(IMPORT_ERROR_CODES as readonly string[]).includes(errorCode)) return null;
  if (stage !== 'commerce-import' || version !== 1 || target !== 'commerce-bundle') return null;
  if (dataHealth !== 'unverified') return null;
  return { requestId, errorCode: errorCode as ImportErrorCode };
};

// The explanation is bounded plain text. Actions are restricted to the fixed reselect code, and
// nothing from the response is rendered as HTML, URL or an automatic upload.
const parseImportHelp = (response: unknown, requestId: string): { explanation: string; actions: string[] } | null => {
  const envelope = (response as { data?: { status?: unknown; data?: unknown } })?.data;
  const payload = envelope?.data as Record<string, unknown> | undefined;
  if (envelope?.status !== 'SUCCESS' || !payload || typeof payload !== 'object') return null;
  if (payload.requestId !== requestId || payload.dataHealth !== 'unverified') return null;
  const explanation = plainText(payload.explanation, EXPLANATION_MAX);
  if (!explanation) return null;
  const actions = payload.actions;
  if (!Array.isArray(actions) || actions.length > 2) return null;
  if (!actions.every(action => action === RESELECT_FILES)) return null;
  return { explanation, actions: actions as string[] };
};

export default function ImportHelp({
  diagnostic,
  onReselectFiles,
}: {
  diagnostic: ImportDiagnostic;
  onReselectFiles?: () => void;
}) {
  const [helpBusy, setHelpBusy] = useState(false);
  const [helpError, setHelpError] = useState('');
  const [help, setHelp] = useState<{ requestId: string; explanation: string; actions: string[] } | null>(null);
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const activeId = useRef<string | null>(null);
  const explainButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current = false;
      activeId.current = null;
      controller.current?.abort();
      controller.current = null;
    };
  }, []);

  const cancelHelp = () => {
    controller.current?.abort();
    controller.current = null;
    activeId.current = null;
    pending.current = false;
    setHelpBusy(false);
    setHelpError('AI 오류 설명 요청을 취소했습니다. 다시 요청하거나 파일을 다시 선택할 수 있습니다.');
    explainButton.current?.focus();
  };

  const explain = async () => {
    const requestId = diagnostic.requestId;
    if (pending.current || help?.requestId === requestId) return;
    const abort = new AbortController();
    controller.current = abort;
    pending.current = true;
    activeId.current = requestId;
    setHelpBusy(true);
    setHelpError('');
    try {
      const response = await post('/commerce/import-help', { requestId }, { timeout: 120000, signal: abort.signal });
      if (abort.signal.aborted || !mounted.current || activeId.current !== requestId) return;
      const parsed = parseImportHelp(response, requestId);
      if (!parsed) throw new Error('invalid import help response');
      setHelp({ requestId, ...parsed });
    } catch {
      if (abort.signal.aborted || !mounted.current || activeId.current !== requestId) return;
      setHelpError(HELP_ERROR);
    } finally {
      if (controller.current === abort) {
        pending.current = false;
        if (mounted.current) setHelpBusy(false);
      }
      if (controller.current === abort) controller.current = null;
    }
  };

  const shown = help?.requestId === diagnostic.requestId ? help : null;
  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button ref={explainButton} onClick={explain} aria-disabled={helpBusy} sx={{ minHeight: 44 }}>
          {helpBusy ? '오류 설명 준비 중…' : 'AI로 오류 설명 보기'}
        </Button>
        {helpBusy && (
          <Button onClick={cancelHelp} sx={{ minHeight: 44 }}>
            오류 설명 취소
          </Button>
        )}
        {onReselectFiles && (
          <Button onClick={onReselectFiles} sx={{ minHeight: 44 }}>
            파일 다시 선택
          </Button>
        )}
      </Stack>
      {helpError && (
        <Typography role="status" variant="body2" sx={{ mt: 1 }}>
          {helpError}
        </Typography>
      )}
      {shown && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="subtitle2" component="p">
            가능한 원인
          </Typography>
          <Typography
            variant="body2"
            role="status"
            aria-live="polite"
            sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {shown.explanation}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            복구 상태: 확인되지 않음 (unverified)
          </Typography>
        </Box>
      )}
    </Box>
  );
}
