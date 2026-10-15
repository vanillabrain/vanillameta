import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import DatabaseService from '@/api/databaseService';
import { post } from '@/helpers/apiHelper';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import MetricTrend from './MetricTrend';
import { AnalysisUiProvider } from '@/components/analysis/AnalysisUi';
import { analysisOptions } from '../analysisOptions';
import { validSemanticCandidate, validSemanticPreview } from '../semanticPreview';

type Props = {
  open: boolean;
  onClose: () => void;
  dashboardId?: number;
  currentDraft?: any;
  initialDatabaseId?: number;
  onSaved: (id: number) => void;
};
import { validDraft, validPreview, responseData, errorMessage } from '../dashboardPreview';

function AiDashboardPanelContent({ open, onClose, dashboardId, currentDraft, initialDatabaseId, onSaved }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const structuredCreation = dashboardId === undefined && !currentDraft;
  const [semanticPlan, setSemanticPlan] = useState<any>(null);
  const creationRequest = useRef<any>(null);
  const generationAbort = useRef<AbortController | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [databaseId, setDatabaseId] = useState<number | ''>('');
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [canSave, setCanSave] = useState(false);
  const [busy, setBusy] = useState<'generate' | 'save' | null>(null);
  const [error, setError] = useState('');
  const session = useRef(0);
  const initialDraft = useRef(currentDraft);
  initialDraft.current = currentDraft;
  const activeRequest = useRef(false);

  useEffect(() => {
    generationAbort.current?.abort();
    creationRequest.current = null;
    setSemanticPlan(null);
    session.current += 1;
    const token = session.current;
    activeRequest.current = false;
    setBusy(null);
    setPrompt('');
    setDraft(open ? initialDraft.current || null : null);
    setDatabaseId(open && initialDraft.current?.databaseId ? Number(initialDraft.current.databaseId) : '');
    setPreview(null);
    setCanSave(false);
    setError('');
    setSources([]);
    if (!open) return;
    setSourceLoading(true);
    DatabaseService.selectDatabaseList()
      .then(response => {
        if (token !== session.current) return;
        const list = responseData(response);
        if (!Array.isArray(list)) throw new Error('Could not load data sources.');
        const available = list.filter(source => source.engine === 'duckdb' && !source.configError);
        setSources(available);
        if (
          initialDatabaseId !== undefined &&
          !initialDraft.current &&
          available.some(source => Number(source.id) === initialDatabaseId)
        ) {
          setDatabaseId(initialDatabaseId);
        }
      })
      .catch(err => {
        if (token === session.current) setError(errorMessage(err));
      })
      .finally(() => {
        if (token === session.current) setSourceLoading(false);
      });
    return () => {
      generationAbort.current?.abort();
      session.current += 1;
    };
  }, [open, dashboardId, initialDatabaseId]);

  const close = () => {
    if (busy === 'save') return;
    generationAbort.current?.abort();
    creationRequest.current = null;
    setSemanticPlan(null);
    session.current += 1;
    activeRequest.current = false;
    setDraft(null);
    setPreview(null);
    setPrompt('');
    setCanSave(false);
    setBusy(null);
    setError('');
    onClose();
  };

  const stopGeneration = () => {
    session.current += 1;
    generationAbort.current?.abort();
    activeRequest.current = false;
    setBusy(null);
    setCanSave(false);
    creationRequest.current = null;
  };

  const generate = async () => {
    if (activeRequest.current || !databaseId || !prompt.trim()) return;
    activeRequest.current = true;
    const token = session.current;
    setBusy('generate');
    creationRequest.current = null;
    setCanSave(false);
    setError('');
    try {
      if (structuredCreation) {
        const controller = new AbortController();
        generationAbort.current = controller;
        const options = { timeout: 180000, signal: controller.signal };
        const candidate = responseData(
          await post('/bi/analysis-proposals', { sourceId: databaseId, prompt: prompt.trim() }, options),
        );
        if (token !== session.current) return;
        if (!validSemanticCandidate(candidate, databaseId))
          throw new Error('The generated dashboard is incomplete. Please try again.');
        const result = responseData(await post('/bi/analysis-proposals/preview', { proposal: candidate.proposal }, options));
        if (token !== session.current) return;
        if (!validSemanticPreview(result, databaseId))
          throw new Error('The dashboard preview is incomplete. Please try again.');
        creationRequest.current = {
          proposal: result.proposal,
          previewDigest: result.previewDigest,
          requestId: crypto.randomUUID(),
        };
        setDraft(result.preview.draft);
        setPreview(result.preview);
        setSemanticPlan(result.plan);
        setCanSave(true);
        return;
      }
      const candidate = responseData(
        await post(
          '/ai/dashboard-draft',
          {
            databaseId,
            prompt: prompt.trim(),
            dashboardId,
            currentDraft: Number(draft?.databaseId) === databaseId ? draft : undefined,
          },
          { timeout: 180000 },
        ),
      );
      if (token !== session.current) return;
      if (!validDraft(candidate) || Number(candidate.databaseId) !== databaseId)
        throw new Error('The generated dashboard is incomplete. Please try again.');
      setDraft(candidate);
      const nextPreview = responseData(
        await post('/ai/dashboard-preview', { draft: candidate, dashboardId, includeTrends: true }, { timeout: 180000 }),
      );
      if (token !== session.current) return;
      if (!validPreview(nextPreview) || Number(nextPreview.draft.databaseId) !== databaseId)
        throw new Error('The dashboard preview is incomplete. Please try again.');
      setDraft(nextPreview.draft);
      setPreview(nextPreview);
      setPrompt('');
      setCanSave(true);
    } catch (err) {
      if (token === session.current) setError(errorMessage(err));
    } finally {
      if (token === session.current) {
        activeRequest.current = false;
        setBusy(null);
      }
    }
  };

  const save = async () => {
    if (activeRequest.current || !canSave || !preview || (structuredCreation && !creationRequest.current)) return;
    activeRequest.current = true;
    const token = session.current;
    setBusy('save');
    setError('');
    try {
      const saved = responseData(
        structuredCreation
          ? await post('/bi/analysis-proposals/save', creationRequest.current, { timeout: 180000 })
          : await post('/ai/dashboard-save', { draft: preview.draft, dashboardId }, { timeout: 180000 }),
      );
      if (token !== session.current) return;
      if (!Number.isInteger(saved?.id) || saved.id <= 0) throw new Error('The dashboard could not be saved.');
      setCanSave(false);
      session.current += 1;
      setDraft(null);
      setPreview(null);
      setBusy(null);
      activeRequest.current = false;
      onClose();
      onSaved(saved.id);
    } catch (err) {
      if (token === session.current) {
        setError(errorMessage(err));
        const status = (err as any)?.response?.status;
        const retryable = structuredCreation && (!status || status >= 500 || status === 408 || status === 429);
        setCanSave(!!retryable);
        if (!retryable) creationRequest.current = null;
      }
    } finally {
      if (token === session.current) {
        activeRequest.current = false;
        setBusy(null);
      }
    }
  };

  return (
    <Dialog open={open} onClose={close} fullScreen={fullScreen} fullWidth maxWidth="lg" aria-labelledby="ai-dashboard-title">
      <DialogTitle id="ai-dashboard-title">
        {t(dashboardId ? 'ai.dashboardEdit' : 'ai.dashboardCreate', {
          defaultValue: dashboardId ? 'Edit dashboard with AI' : 'Create dashboard with AI',
        })}
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
        <Stack spacing={2}>
          <Typography variant="body2">
            {t('ai.dashboardInstructions', {
              defaultValue:
                'Describe the dashboard you want, review the preview, then save. Changes are applied only when you save.',
            })}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {error}
            </Alert>
          )}
          <TextField
            id="ai-dashboard-source"
            SelectProps={{ inputProps: { 'aria-labelledby': 'ai-dashboard-source-label' } }}
            select
            fullWidth
            label={t('ai.dataSource', { defaultValue: 'Data source' })}
            value={databaseId}
            disabled={!!busy || sourceLoading}
            onChange={event => {
              setDatabaseId(Number(event.target.value));
              creationRequest.current = null;
              setCanSave(false);
            }}
          >
            {sources.map(source => (
              <MenuItem key={source.id} value={source.id}>
                {source.name}
              </MenuItem>
            ))}
          </TextField>
          {!sourceLoading && !sources.length && (
            <Typography variant="body2">
              {t('ai.noSources', { defaultValue: 'No data sources are available. Add a data source first.' })}
            </Typography>
          )}
          <TextField
            id="ai-dashboard-prompt"
            multiline
            InputLabelProps={{ shrink: true }}
            minRows={3}
            inputProps={{ maxLength: 2000 }}
            fullWidth
            label={t('ai.dashboardPrompt', { defaultValue: 'What would you like to see?' })}
            value={prompt}
            disabled={!!busy}
            onChange={event => {
              setPrompt(event.target.value);
              creationRequest.current = null;
              setCanSave(false);
            }}
            placeholder={t('ai.dashboardPromptExample', {
              defaultValue: 'Show total requests, average bid floor, and requests by device.',
            })}
          />
          <Button
            variant="contained"
            onClick={generate}
            disabled={!!busy || !databaseId || !prompt.trim() || sourceLoading}
            sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
          >
            {busy === 'generate'
              ? t('ai.generating', { defaultValue: 'Generating preview…' })
              : t(!structuredCreation && draft ? 'ai.revisePreview' : 'ai.generatePreview', {
                  defaultValue: !structuredCreation && draft ? 'Revise preview' : 'Generate preview',
                })}
          </Button>
          {preview && (
            <>
              {!canSave && (
                <Alert severity="info">
                  {t('ai.previewNeedsUpdate', {
                    defaultValue: 'This is the previous preview. Generate a new preview before saving.',
                  })}
                </Alert>
              )}
              <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                {preview.draft.title}
              </Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.draft.explanation}</Typography>
              {semanticPlan && (
                <Typography role="status" sx={{ fontSize: 12, color: 'text.secondary', overflowWrap: 'anywhere' }}>
                  {`지표 ${new Set(semanticPlan.measures.map(m => m.identity)).size}개 · 분류 ${
                    semanticPlan.dimensions.length
                  }개 · 기존 지표 ${
                    new Set(semanticPlan.measures.filter(m => m.action === 'reuse').map(m => m.metricId)).size
                  }개 재사용`}
                </Typography>
              )}
              <Box component="details" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Typography component="summary" sx={{ cursor: 'pointer', fontSize: 13 }}>
                  계산 기준
                </Typography>
                {semanticPlan && (
                  <Stack spacing={1} sx={{ mt: 1, minWidth: 0 }}>
                    {semanticPlan.measures.map(m => (
                      <Typography key={m.key} sx={{ fontSize: 12, overflowWrap: 'anywhere' }}>
                        {`${m.definition.label} · ${m.action === 'reuse' ? '기존 지표 재사용' : '저장 시 새 지표 생성'} · ${
                          m.definition.aggregation
                        }(${m.definition.column})`}
                      </Typography>
                    ))}
                    {semanticPlan.dimensions.map(d => (
                      <Typography
                        key={d.key}
                        sx={{ fontSize: 12, overflowWrap: 'anywhere' }}
                      >{`분류: ${d.label} · ${d.type}`}</Typography>
                    ))}
                  </Stack>
                )}
                {preview.widgets.map((widget, index) => (
                  <Box key={index} sx={{ mt: 1.5 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{widget.title}</Typography>
                    <Box
                      component="pre"
                      sx={{ m: 0, mt: 0.5, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                    >
                      {widget.sql}
                    </Box>
                  </Box>
                ))}
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                {preview.widgets.map((widget, index) => (
                  <Box
                    key={index}
                    sx={{
                      minWidth: 0,
                      gridColumn: widget.type === 'BOARD_NUMERIC' ? 'auto' : '1 / -1',

                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <Box
                      sx={{
                        height:
                          widget.type === 'BOARD_NUMERIC'
                            ? 150
                            : Math.min(900, Math.max(360, widget.datas.length * 28 + 100)),
                        minWidth: 0,
                      }}
                    >
                      <WidgetViewer
                        title={widget.title}
                        description={widget.description}
                        widgetType={widget.type}
                        widgetOption={analysisOptions(widget)}
                        dataSet={widget.datas}
                        isInvalidData={false}
                      />
                    </Box>
                    {widget.type === 'BOARD_NUMERIC' && (
                      <MetricTrend
                        trend={widget.trend}
                        unavailable={widget.trendUnavailable}
                        title={widget.title}
                        prefix={widget.prefix}
                        suffix={widget.suffix}
                        decimalPlaces={widget.decimalPlaces ?? 0}
                      />
                    )}
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 1.5, flexWrap: 'wrap', gap: 1, '& > :not(:first-of-type)': { ml: 0 } }}>
        <Button onClick={structuredCreation && busy === 'generate' ? stopGeneration : close} disabled={busy === 'save'}>
          {structuredCreation && busy === 'generate'
            ? t('ai.stopGeneration', { defaultValue: '생성 중지' })
            : t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button variant="contained" onClick={save} disabled={!!busy || !canSave || !preview}>
          {busy === 'save' ? t('ai.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AiDashboardPanel(props: Props) {
  return (
    <AnalysisUiProvider>
      <AiDashboardPanelContent {...props} />
    </AnalysisUiProvider>
  );
}
