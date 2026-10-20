import React, { useEffect, useId, useRef, useState } from 'react';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import PageTitleBox from '@/components/PageTitleBox';
import DataGrid from '@/components/datagrid';
import Seo from '@/seo/Seo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import DeleteButton from '@/components/button/DeleteButton';
import MetricService, { MetricDefinition } from '@/api/metricService';
import MetricDeleteDialog, { MetricDeleteTarget } from './MetricDeleteDialog';
import { personalLibrarySessionScope } from '@/api/personalLibraryService';
import { STORAGE_ACCESS_TOKEN } from '@/helpers/authHelper';
import DatabaseService from '@/api/databaseService';
import { createColumns } from '@/utils/util';
import { SnackbarContext } from '@/contexts/AlertContext';

type Aggregation = MetricDefinition['aggregation'];

/** 지표 폼에서 문자열로만 입력되는 필드. */
type TextFieldKey = 'name' | 'description' | 'tableName' | 'expression' | 'groupBy';

const AGGREGATIONS: Aggregation[] = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT_DISTINCT'];

/** Radix select는 문자열을 돌려주므로 알려진 집계 함수만 통과시켜 유니온을 좁힌다. */
const isAggregation = (value: string): value is Aggregation => (AGGREGATIONS as readonly string[]).includes(value);

/** Radix select items only carry string values; keep the unset choice addressable. */
const SELECT_UNSET = '__none__';

const EMPTY_FORM: MetricDefinition = {
  name: '',
  description: '',
  databaseId: 0,
  tableName: '',
  aggregation: 'SUM',
  expression: '',
  groupBy: '',
};

/**
 * 시맨틱 레이어 — 재사용 가능한 메트릭(지표) 정의 관리 페이지
 */
const Metric = () => {
  const [, refresh] = useState(0);
  const scope = personalLibrarySessionScope();
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_ACCESS_TOKEN || event.key === 'vm:editor-draft-auth:v1')
        refresh(value => value + 1);
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  return <MetricWorkspace key={scope ?? 'signed-out'} scope={scope} />;
};
const MetricWorkspace = ({ scope }: { scope: string | null }) => {
  const { t } = useTranslation();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const queryClient = useQueryClient();
  const databaseLabelId = useId();
  const aggregationLabelId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<MetricDefinition>(EMPTY_FORM);
  const [evalResult, setEvalResult] = useState<{ id: number; name: string; rows: any[] } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MetricDeleteTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const mounted = useRef(true);
  const evaluation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const isCurrent = () => mounted.current && !!scope && personalLibrarySessionScope() === scope;
  const readList = async (load: () => Promise<any>, signal: AbortSignal) => {
    const res = await load();
    if (signal.aborted || !isCurrent()) throw new Error('session changed');
    if (res.data?.status !== 'SUCCESS' || !Array.isArray(res.data.data)) throw new Error('invalid list');
    return res.data.data;
  };

  const metricQuery = useQuery({
    queryKey: ['metrics', scope],
    queryFn: ({ signal }) => readList(() => MetricService.selectMetrics(), signal),
    enabled: !!scope,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const metrics = metricQuery.isError ? [] : metricQuery.data ?? [];
  const databaseQuery = useQuery({
    queryKey: ['databases', 'metric', scope],
    queryFn: ({ signal }) => readList(() => DatabaseService.selectDatabaseList(), signal),
    enabled: !!scope,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const databases = databaseQuery.isError ? [] : databaseQuery.data ?? [];
  const createMutation = useMutation({
    mutationFn: (data: MetricDefinition) => MetricService.createMetric(data),
  });

  const handleCreate = () => {
    if (!isCurrent() || createMutation.isPending) return;
    if (!form.name || !form.databaseId || !form.tableName || !form.expression) {
      alert.error(t('metric.form.required'));
      return;
    }
    createMutation.mutate(
      { ...form, groupBy: form.groupBy || undefined },
      {
        onSuccess: res => {
          if (!isCurrent()) return;
          if (res.data?.status === 'SUCCESS') {
            void queryClient.invalidateQueries({ queryKey: ['metrics'] });
            snackbar.success(t('metric.form.created'));
            setDialogOpen(false);
            setForm(EMPTY_FORM);
          } else {
            alert.error(res.data?.message || t('metric.form.createFailed'));
          }
        },
        onError: () => {
          if (isCurrent()) alert.error(t('metric.form.createFailed'));
        },
      },
    );
  };

  const handleEvaluate = async (metric: any) => {
    if (!isCurrent()) return;
    evaluation.current += 1;
    const attempt = evaluation.current;
    try {
      const res = await MetricService.evaluateMetric(metric.id);
      if (!isCurrent() || attempt !== evaluation.current) return;
      if (res.data?.status === 'SUCCESS') {
        const rows = res.data.data?.result ?? [];
        setEvalResult({ id: metric.id, name: metric.name, rows: Array.isArray(rows) ? rows : [rows] });
      } else {
        alert.error(res.data?.message || t('metric.form.evalFailed'));
      }
    } catch (e: any) {
      if (isCurrent() && attempt === evaluation.current) alert.error(t('metric.form.evalFailed'));
    }
  };

  const set = (key: TextFieldKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <PageTitleBox
      upperTitle={t('nav.data')}
      upperTitleLink="/data"
      title={t('metric.title')}
      button={
        <Button disabled={!scope} onClick={() => setDialogOpen(true)}>
          {t('metric.add')}
        </Button>
      }
      className="h-full w-full p-0"
    >
      <Seo title={t('metric.title')} />
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        <span className="text-sm text-muted-foreground">{t('metric.description')}</span>

        {metricQuery.isError && (
          <p role="alert">
            지표 목록을 읽지 못했습니다.{' '}
            <Button size="sm" variant="outline" onClick={() => void metricQuery.refetch()}>
              목록 다시 읽기
            </Button>
          </p>
        )}
        {metrics.length === 0 && <span className="text-sm text-muted-foreground">{t('metric.empty')}</span>}

        <ul className="grid list-none grid-cols-1 gap-3 p-0 xl:grid-cols-2">
          {metrics.map((m: any) => (
            <li key={m.id} className="min-w-0 list-none">
              <Card className="h-full gap-3 rounded-lg border border-border p-4 ring-0 sm:p-5">
                <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold [overflow-wrap:anywhere]">{m.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {m.aggregation}({m.expression}) FROM {m.tableName}
                      {m.groupBy ? ` GROUP BY ${m.groupBy}` : ''}
                      {m.description ? ` — ${m.description}` : ''}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Button
                      aria-label={t('metric.evaluateNamed', { name: m.name })}
                      size="sm"
                      variant="outline"
                      onClick={() => handleEvaluate(m)}
                    >
                      {t('metric.evaluate')}
                    </Button>
                    <DeleteButton
                      aria-label={t('data.deleteItem', { name: m.name })}
                      size="icon-sm"
                      width="20"
                      height="20"
                      onClick={() => {
                        setDeleteTarget({ id: m.id, title: m.name });
                        setDeleteOpen(true);
                      }}
                    />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        {evalResult && !metricQuery.isError && (
          <div role="region" aria-label={t('metric.evalResult', { name: evalResult.name })} tabIndex={0}>
            <p role="status" className="mb-2 text-sm font-semibold">
              {t('metric.evalResult', { name: evalResult.name })}
            </p>
            {evalResult.rows.length > 0 ? (
              <DataGrid
                minBodyHeight={150}
                bodyHeight={300}
                data={evalResult.rows}
                columns={createColumns(evalResult.rows)}
                columnOptions={{ resizable: true }}
              />
            ) : (
              <span className="text-sm text-muted-foreground">{t('metric.noResult')}</span>
            )}
          </div>
        )}
      </div>

      <MetricDeleteDialog
        target={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={receipt => {
          if (!isCurrent()) return;
          evaluation.current += 1;
          setEvalResult(previous => (previous?.id === receipt.metricId ? null : previous));
          void queryClient.invalidateQueries({ queryKey: ['metrics'] });
        }}
      />
      <Dialog
        open={dialogOpen}
        onOpenChange={next => {
          if (!next) setDialogOpen(false);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-[600px]">
          <DialogTitle>{t('metric.add')}</DialogTitle>
          <div className="flex flex-col gap-4">
            <TextField autoFocus label={t('metric.form.name')} value={form.name} onChange={set('name')} required />
            <TextField label={t('metric.form.description')} value={form.description} onChange={set('description')} />
            <Field className="min-w-0">
              <FieldLabel id={databaseLabelId}>
                {t('metric.form.database')}
                <span aria-hidden="true"> *</span>
              </FieldLabel>
              <Select
                value={form.databaseId ? String(form.databaseId) : SELECT_UNSET}
                onValueChange={next => setForm(prev => ({ ...prev, databaseId: Number(next) }))}
              >
                <SelectTrigger aria-labelledby={databaseLabelId} className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {databases.map((db: any) => (
                    <SelectItem key={String(db.id)} value={String(db.id)}>
                      {db.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <TextField label={t('metric.form.table')} value={form.tableName} onChange={set('tableName')} required />
            <div className="flex flex-col gap-4 sm:flex-row">
              <Field className="min-w-0 sm:w-[180px] sm:flex-none">
                <FieldLabel id={aggregationLabelId}>
                  {t('metric.form.aggregation')}
                  <span aria-hidden="true"> *</span>
                </FieldLabel>
                <Select
                  value={form.aggregation}
                  onValueChange={next => {
                    if (!isAggregation(next)) return;
                    setForm(prev => ({ ...prev, aggregation: next }));
                  }}
                >
                  <SelectTrigger aria-labelledby={aggregationLabelId} className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {AGGREGATIONS.map(a => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <TextField
                className="min-w-0 flex-1"
                label={t('metric.form.expression')}
                value={form.expression}
                onChange={set('expression')}
                required
              />
            </div>
            <TextField label={t('metric.form.groupBy')} value={form.groupBy} onChange={set('groupBy')} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {t('metric.form.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {t('metric.form.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTitleBox>
  );
};

export default Metric;
