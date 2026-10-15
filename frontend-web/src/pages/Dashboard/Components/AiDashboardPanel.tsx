import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
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
  onSaved: (id: number, intent?: { publication: true; revision?: string }) => void;
};
import { validDraft, validPreview, responseData, errorMessage } from '../dashboardPreview';

function AiDashboardPanelContent({ open, onClose, dashboardId, currentDraft, initialDatabaseId, onSaved }: Props) {
  const { t } = useTranslation();
  const structuredCreation = dashboardId === undefined && !currentDraft;
  const [semanticPlan, setSemanticPlan] = useState<any>(null);
  const creationRequest = useRef<any>(null);
  const confirmedCreation = useRef<any>(null);
  const creationPublication = useRef(false);
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
    confirmedCreation.current = null;
    creationPublication.current = false;
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
    confirmedCreation.current = null;
    creationPublication.current = false;
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
    confirmedCreation.current = null;
    creationPublication.current = false;
  };

  const generate = async () => {
    if (activeRequest.current || !databaseId || !prompt.trim()) return;
    activeRequest.current = true;
    const token = session.current;
    const previous = confirmedCreation.current?.proposal.sourceId === databaseId ? confirmedCreation.current : null;
    setBusy('generate');
    creationRequest.current = null;
    creationPublication.current = false;
    setCanSave(false);
    setError('');
    try {
      if (structuredCreation) {
        const controller = new AbortController();
        generationAbort.current = controller;
        const options = { timeout: 180000, signal: controller.signal };
        const candidate = responseData(
          await post(
            previous ? '/bi/analysis-proposals/question' : '/bi/analysis-proposals',
            previous
              ? { proposal: previous.proposal, previewDigest: previous.previewDigest, prompt: prompt.trim() }
              : { sourceId: databaseId, prompt: prompt.trim() },
            options,
          ),
        );
        if (token !== session.current) return;
        if (
          typeof candidate?.clarification === 'string' &&
          candidate.clarification.trim() &&
          candidate.clarification.length <= 240 &&
          Object.keys(candidate).length === 1
        ) {
          setError(candidate.clarification);
          return;
        }
        if (!validSemanticCandidate(candidate, databaseId))
          throw new Error('The generated dashboard is incomplete. Please try again.');
        const result = responseData(await post('/bi/analysis-proposals/preview', { proposal: candidate.proposal }, options));
        if (token !== session.current) return;
        if (!validSemanticPreview(result, databaseId))
          throw new Error('The dashboard preview is incomplete. Please try again.');
        if (previous && candidate.saveRequested === true && result.previewDigest !== previous.previewDigest)
          throw new Error('미리보기의 계산 기준이 변경됐습니다. 다시 미리보고 저장해 주세요.');
        creationRequest.current = {
          proposal: result.proposal,
          previewDigest: result.previewDigest,
          requestId: previous && candidate.saveRequested === true ? previous.requestId : crypto.randomUUID(),
        };
        confirmedCreation.current = creationRequest.current;
        creationPublication.current = candidate.publicationRequested === true;
        setDraft(result.preview.draft);
        setPreview(result.preview);
        setSemanticPlan(result.plan);
        setCanSave(true);
        if (candidate.saveRequested === true) {
          setBusy('save');
          await persist(token, creationRequest.current, creationPublication.current);
        }
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
      if (token === session.current) {
        setError(errorMessage(err));
        if ((err as any)?.response?.status === 409) confirmedCreation.current = null;
      }
    } finally {
      if (token === session.current) {
        activeRequest.current = false;
        setBusy(null);
      }
    }
  };

  const persist = async (token: number, request: any, publication = false) => {
    try {
      const saved = responseData(
        structuredCreation
          ? await post('/bi/analysis-proposals/save', request, { timeout: 180000 })
          : await post('/ai/dashboard-save', { draft: preview.draft, dashboardId }, { timeout: 180000 }),
      );
      if (token !== session.current) return;
      if (!Number.isSafeInteger(saved?.id) || saved.id <= 0) throw new Error('The dashboard could not be saved.');
      if (publication && saved.replayed !== true && !/^[a-f0-9]{64}$/.test(saved.revision ?? ''))
        throw new Error('저장 결과를 확인하지 못했습니다. 같은 저장 요청으로 다시 확인해 주세요.');
      setCanSave(false);
      session.current += 1;
      setDraft(null);
      setPreview(null);
      setBusy(null);
      activeRequest.current = false;
      onClose();
      if (publication) {
        // A replay proves identity, not the historical revision. It requires a new manual publication preview.
        onSaved(saved.id, { publication: true, ...(saved.replayed !== true ? { revision: saved.revision } : {}) });
      } else onSaved(saved.id);
    } catch (err) {
      if (token === session.current) {
        setError(errorMessage(err));
        const status = (err as any)?.response?.status;
        const retryable = structuredCreation && (!status || status >= 500 || status === 408 || status === 429);
        setCanSave(!!retryable);
        if (!retryable) {
          creationRequest.current = null;
          confirmedCreation.current = null;
          creationPublication.current = false;
        }
      }
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
    await persist(token, creationRequest.current, creationPublication.current);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-labelledby="ai-dashboard-title"
        className="h-full max-h-full w-full max-w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[85vh] sm:max-w-[1200px] sm:rounded-xl"
      >
        <div className="border-b border-border px-4 py-3">
          <DialogTitle id="ai-dashboard-title">
            {t(dashboardId ? 'ai.dashboardEdit' : 'ai.dashboardCreate', {
              defaultValue: dashboardId ? 'Edit dashboard with AI' : 'Create dashboard with AI',
            })}
          </DialogTitle>
        </div>
        <div className="min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              {t('ai.dashboardInstructions', {
                defaultValue:
                  'Describe the dashboard you want, review the preview, then save. Changes are applied only when you save.',
              })}
            </p>
            {error && (
              <Notice severity="error" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {error}
              </Notice>
            )}
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label id="ai-dashboard-source-label" htmlFor="ai-dashboard-source">
                {t('ai.dataSource', { defaultValue: 'Data source' })}
              </Label>
              <Select
                value={databaseId === '' ? '' : String(databaseId)}
                disabled={!!busy || sourceLoading}
                onValueChange={value => {
                  setDatabaseId(Number(value));
                  creationRequest.current = null;
                  confirmedCreation.current = null;
                  creationPublication.current = false;
                  setCanSave(false);
                }}
              >
                <SelectTrigger id="ai-dashboard-source" aria-labelledby="ai-dashboard-source-label" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(source => (
                    <SelectItem key={source.id} value={String(source.id)}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!sourceLoading && !sources.length && (
              <p className="text-sm">
                {t('ai.noSources', { defaultValue: 'No data sources are available. Add a data source first.' })}
              </p>
            )}
            <TextField
              id="ai-dashboard-prompt"
              multiline
              rows={3}
              inputProps={{ maxLength: 2000 }}
              className="w-full"
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
            {structuredCreation && (
              <p className="text-xs text-muted-foreground">
                미리보기 뒤 ‘현재 초안을 저장하고 게시 준비해 줘’라고 이어서 질문할 수 있습니다. 링크 공개는 게시 화면에서
                확인 후 실행합니다.
              </p>
            )}
            <Button
              onClick={generate}
              disabled={!!busy || !databaseId || !prompt.trim() || sourceLoading}
              className="self-stretch sm:self-start"
            >
              {busy === 'generate'
                ? t('ai.generating', { defaultValue: 'Generating preview…' })
                : structuredCreation && confirmedCreation.current
                ? t('ai.executeRequest', { defaultValue: '질문 실행' })
                : t(!structuredCreation && draft ? 'ai.revisePreview' : 'ai.generatePreview', {
                    defaultValue: !structuredCreation && draft ? 'Revise preview' : 'Generate preview',
                  })}
            </Button>
            {preview && (
              <>
                {!canSave && (
                  <Notice severity="info">
                    {t('ai.previewNeedsUpdate', {
                      defaultValue: 'This is the previous preview. Generate a new preview before saving.',
                    })}
                  </Notice>
                )}
                <h3 className="text-xl [overflow-wrap:anywhere]">{preview.draft.title}</h3>
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{preview.draft.explanation}</p>
                {semanticPlan && (
                  <p role="status" className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {`지표 ${new Set(semanticPlan.measures.map(m => m.identity)).size}개 · 분류 ${
                      semanticPlan.dimensions.length
                    }개 · 기존 지표 ${
                      new Set(semanticPlan.measures.filter(m => m.action === 'reuse').map(m => m.metricId)).size
                    }개 재사용`}
                  </p>
                )}
                <details className="rounded border border-border p-3">
                  <summary className="cursor-pointer text-[13px]">계산 기준</summary>
                  {semanticPlan && (
                    <div className="mt-2 flex min-w-0 flex-col gap-2">
                      {semanticPlan.measures.map(m => (
                        <p key={m.key} className="text-xs [overflow-wrap:anywhere]">
                          {`${m.definition.label} · ${
                            m.action === 'reuse' ? '기존 지표 재사용' : '저장 시 새 지표 생성'
                          } · ${m.definition.aggregation}(${m.definition.column})`}
                        </p>
                      ))}
                      {semanticPlan.dimensions.map(d => (
                        <p key={d.key} className="text-xs [overflow-wrap:anywhere]">{`분류: ${d.label} · ${d.type}`}</p>
                      ))}
                    </div>
                  )}
                  {preview.widgets.map((widget, index) => (
                    <div key={index} className="mt-3">
                      <p className="text-[13px] font-semibold">{widget.title}</p>
                      <pre className="mt-1 mb-0 text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">{widget.sql}</pre>
                    </div>
                  ))}
                </details>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))]">
                  {preview.widgets.map((widget, index) => (
                    <div
                      key={index}
                      className={
                        widget.type === 'BOARD_NUMERIC'
                          ? 'min-w-0 rounded-lg border border-border'
                          : 'col-span-full min-w-0 rounded-lg border border-border'
                      }
                    >
                      <div
                        className="min-w-0"
                        style={{
                          height:
                            widget.type === 'BOARD_NUMERIC'
                              ? 150
                              : Math.min(900, Math.max(360, widget.datas.length * 28 + 100)),
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
                      </div>
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
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-3">
          <Button
            variant="ghost"
            onClick={structuredCreation && busy === 'generate' ? stopGeneration : close}
            disabled={busy === 'save'}
          >
            {structuredCreation && busy === 'generate'
              ? t('ai.stopGeneration', { defaultValue: '생성 중지' })
              : t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button onClick={save} disabled={!!busy || !canSave || !preview}>
            {busy === 'save' ? t('ai.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      </DialogContent>
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
