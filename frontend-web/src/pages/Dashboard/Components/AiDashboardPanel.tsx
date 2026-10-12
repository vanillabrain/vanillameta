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
import { analysisOptions } from '../analysisOptions';

type Props = {
  open: boolean;
  onClose: () => void;
  dashboardId?: number;
  currentDraft?: any;
  onSaved: (id: number) => void;
};
const widgetTypes = ['BOARD_NUMERIC', 'CHART_COLUMN', 'CHART_BAR', 'CHART_LINE'];
const validDraft = (draft: any) =>
  draft &&
  Number(draft.databaseId) > 0 &&
  typeof draft.title === 'string' &&
  draft.title.trim() &&
  Array.isArray(draft.widgets) &&
  draft.widgets.length > 0 &&
  draft.widgets.every(
    widget =>
      widgetTypes.includes(widget.type) &&
      typeof widget.sql === 'string' &&
      widget.sql.trim() &&
      typeof widget.valueField === 'string' &&
      widget.valueField &&
      (widget.type === 'BOARD_NUMERIC' || (typeof widget.categoryField === 'string' && widget.categoryField)),
  );
const validPreview = (preview: any) =>
  validDraft(preview?.draft) &&
  Array.isArray(preview.widgets) &&
  preview.widgets.length === preview.draft.widgets.length &&
  preview.widgets.every((widget, index) => {
    const definition = preview.draft.widgets[index];
    if (!Array.isArray(widget.datas) || !Array.isArray(widget.fields)) return false;
    const fields = widget.fields.map(field => (typeof field === 'string' ? field : field.name ?? field.columnName));
    return (
      widget.type === definition.type &&
      widget.sql === definition.sql &&
      widget.valueField === definition.valueField &&
      widget.categoryField === definition.categoryField &&
      fields.includes(definition.valueField) &&
      (definition.type === 'BOARD_NUMERIC' || fields.includes(definition.categoryField))
    );
  });
const responseData = (response: any) => {
  if (response?.data?.status !== 'SUCCESS') throw new Error(response?.data?.message || 'Request failed.');
  return response.data.data;
};
const errorMessage = (error: any) => {
  const message = error?.response?.data?.message;
  return (Array.isArray(message) ? message.join('\n') : message) || error?.message || 'Request failed.';
};

export default function AiDashboardPanel({ open, onClose, dashboardId, currentDraft, onSaved }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
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
        setSources(list);
      })
      .catch(err => {
        if (token === session.current) setError(errorMessage(err));
      })
      .finally(() => {
        if (token === session.current) setSourceLoading(false);
      });
    return () => {
      session.current += 1;
    };
  }, [open, dashboardId]);

  const close = () => {
    if (busy === 'save') return;
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

  const generate = async () => {
    if (activeRequest.current || !databaseId || !prompt.trim()) return;
    activeRequest.current = true;
    const token = session.current;
    setBusy('generate');
    setCanSave(false);
    setError('');
    try {
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
        await post('/ai/dashboard-preview', { draft: candidate, dashboardId }, { timeout: 180000 }),
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
    if (activeRequest.current || !canSave || !preview) return;
    activeRequest.current = true;
    const token = session.current;
    setBusy('save');
    setError('');
    try {
      const saved = responseData(
        await post('/ai/dashboard-save', { draft: preview.draft, dashboardId }, { timeout: 180000 }),
      );
      if (token !== session.current) return;
      if (!Number.isInteger(saved?.id) || saved.id <= 0) throw new Error('The dashboard could not be saved.');
      setCanSave(false);
      session.current += 1;
      setDraft(null);
      setPreview(null);
      setBusy(null);
      activeRequest.current = false;
      onSaved(saved.id);
      onClose();
    } catch (err) {
      if (token === session.current) {
        setError(errorMessage(err));
        setCanSave(false);
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
            select
            fullWidth
            label={t('ai.dataSource', { defaultValue: 'Data source' })}
            value={databaseId}
            disabled={!!busy || sourceLoading}
            onChange={event => {
              setDatabaseId(Number(event.target.value));
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
            multiline
            minRows={3}
            fullWidth
            label={t('ai.dashboardPrompt', { defaultValue: 'What would you like to see?' })}
            value={prompt}
            disabled={!!busy}
            onChange={event => {
              setPrompt(event.target.value);
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
              : t(draft ? 'ai.revisePreview' : 'ai.generatePreview', {
                  defaultValue: draft ? 'Revise preview' : 'Generate preview',
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
              <Box component="details" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Typography component="summary" sx={{ cursor: 'pointer', fontSize: 13 }}>
                  SQL · 계산식 확인
                </Typography>
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
                      height:
                        widget.type === 'BOARD_NUMERIC' ? 220 : Math.min(900, Math.max(360, widget.datas.length * 28 + 100)),
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
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
                ))}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={close} disabled={busy === 'save'}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button variant="contained" onClick={save} disabled={!!busy || !canSave || !preview}>
          {busy === 'save' ? t('ai.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
