import React, { useId, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DeleteIcon from '@mui/icons-material/Delete';
import PageTitleBox from '@/components/PageTitleBox';
import DataGrid from '@/components/datagrid';
import Seo from '@/seo/Seo';
import MetricService, { MetricDefinition } from '@/api/metricService';
import DatabaseService from '@/api/databaseService';
import { createColumns } from '@/utils/util';
import { SnackbarContext } from '@/contexts/AlertContext';

const AGGREGATIONS = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'COUNT_DISTINCT'];

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
  const { t } = useTranslation();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const queryClient = useQueryClient();
  const databaseLabelId = useId();
  const aggregationLabelId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<MetricDefinition>(EMPTY_FORM);
  const [evalResult, setEvalResult] = useState<{ name: string; rows: any[] } | null>(null);

  const { data: metrics = [] } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => MetricService.selectMetrics().then(res => res.data?.data ?? []),
  });

  const { data: databases = [] } = useQuery({
    queryKey: ['databases'],
    queryFn: () => DatabaseService.selectDatabaseList().then(res => res.data?.data ?? []),
  });

  const invalidate = { onSuccess: () => queryClient.invalidateQueries({ queryKey: ['metrics'] }) };

  const createMutation = useMutation({
    mutationFn: (data: MetricDefinition) => MetricService.createMetric(data),
    ...invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => MetricService.deleteMetric(id),
    ...invalidate,
  });

  const handleCreate = () => {
    if (!form.name || !form.databaseId || !form.tableName || !form.expression) {
      alert.error(t('metric.form.required'));
      return;
    }
    createMutation.mutate(
      { ...form, groupBy: form.groupBy || undefined },
      {
        onSuccess: res => {
          if (res.data?.status === 'SUCCESS') {
            snackbar.success(t('metric.form.created'));
            setDialogOpen(false);
            setForm(EMPTY_FORM);
          } else {
            alert.error(res.data?.message || t('metric.form.createFailed'));
          }
        },
        onError: () => alert.error(t('metric.form.createFailed')),
      },
    );
  };

  const handleEvaluate = async (metric: any) => {
    try {
      const res = await MetricService.evaluateMetric(metric.id);
      if (res.data?.status === 'SUCCESS') {
        const rows = res.data.data?.result ?? [];
        setEvalResult({ name: metric.name, rows: Array.isArray(rows) ? rows : [rows] });
      } else {
        alert.error(res.data?.message || t('metric.form.evalFailed'));
      }
    } catch (e: any) {
      alert.error(e?.response?.data?.data || t('metric.form.evalFailed'));
    }
  };

  const set = (key: keyof MetricDefinition) => (e: any) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <PageTitleBox
      upperTitle={t('nav.data')}
      upperTitleLink="/data"
      title={t('metric.title')}
      button={
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          {t('metric.add')}
        </Button>
      }
      sx={{ p: 0, width: '100%', height: '100%' }}
    >
      <Seo title={t('metric.title')} />
      <Stack spacing="16px" sx={{ p: '30px 25px 40px 25px' }}>
        <Typography sx={{ fontSize: '13px', color: '#767676' }}>{t('metric.description')}</Typography>

        {metrics.length === 0 && <Typography sx={{ fontSize: '14px', color: '#555' }}>{t('metric.empty')}</Typography>}

        {metrics.map((m: any) => (
          <Card key={m.id} sx={{ p: '16px 20px', border: 'solid 1px #e2e2e2', boxShadow: 'none', borderRadius: '8px' }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '15px', fontWeight: 600, overflowWrap: 'anywhere' }}>{m.name}</Typography>
                <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: '4px', overflowWrap: 'anywhere' }}>
                  {m.aggregation}({m.expression}) FROM {m.tableName}
                  {m.groupBy ? ` GROUP BY ${m.groupBy}` : ''}
                  {m.description ? ` — ${m.description}` : ''}
                </Typography>
              </Box>
              <Stack direction="row" spacing="8px" alignItems="center" sx={{ flexShrink: 0 }}>
                <Button
                  aria-label={t('metric.evaluateNamed', { name: m.name })}
                  size="small"
                  variant="outlined"
                  onClick={() => handleEvaluate(m)}
                >
                  {t('metric.evaluate')}
                </Button>
                <IconButton
                  aria-label={t('data.deleteItem', { name: m.name })}
                  size="small"
                  onClick={() => deleteMutation.mutate(m.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          </Card>
        ))}

        {evalResult && (
          <Box role="region" aria-label={t('metric.evalResult', { name: evalResult.name })} tabIndex={0}>
            <Typography role="status" sx={{ fontSize: '14px', fontWeight: 600, mb: '8px' }}>
              {t('metric.evalResult', { name: evalResult.name })}
            </Typography>
            {evalResult.rows.length > 0 ? (
              <DataGrid
                minBodyHeight={150}
                bodyHeight={300}
                data={evalResult.rows}
                columns={createColumns(evalResult.rows)}
                columnOptions={{ resizable: true }}
              />
            ) : (
              <Typography sx={{ fontSize: '13px', color: '#767676' }}>{t('metric.noResult')}</Typography>
            )}
          </Box>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('metric.add')}</DialogTitle>
        <DialogContent>
          <Stack spacing="16px" sx={{ mt: '8px' }}>
            <TextField
              autoFocus
              size="small"
              label={t('metric.form.name')}
              value={form.name}
              onChange={set('name')}
              required
            />
            <TextField
              size="small"
              label={t('metric.form.description')}
              value={form.description}
              onChange={set('description')}
            />
            <FormControl size="small" required>
              <InputLabel id={databaseLabelId}>{t('metric.form.database')}</InputLabel>
              <Select
                labelId={databaseLabelId}
                value={form.databaseId || ''}
                label={t('metric.form.database')}
                onChange={e => setForm(prev => ({ ...prev, databaseId: Number(e.target.value) }))}
              >
                {databases.map((db: any) => (
                  <MenuItem key={db.id} value={db.id}>
                    {db.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label={t('metric.form.table')}
              value={form.tableName}
              onChange={set('tableName')}
              required
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing="16px">
              <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 180 } }} required>
                <InputLabel id={aggregationLabelId}>{t('metric.form.aggregation')}</InputLabel>
                <Select
                  labelId={aggregationLabelId}
                  value={form.aggregation}
                  label={t('metric.form.aggregation')}
                  onChange={set('aggregation')}
                >
                  {AGGREGATIONS.map(a => (
                    <MenuItem key={a} value={a}>
                      {a}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={t('metric.form.expression')}
                value={form.expression}
                onChange={set('expression')}
                required
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField size="small" label={t('metric.form.groupBy')} value={form.groupBy} onChange={set('groupBy')} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('metric.form.cancel')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={createMutation.isPending}>
            {t('metric.form.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageTitleBox>
  );
};

export default Metric;
