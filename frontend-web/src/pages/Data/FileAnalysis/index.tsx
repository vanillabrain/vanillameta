import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import PageTitleBox from '@/components/PageTitleBox';
import DatabaseService from '@/api/databaseService';
import { useNavigate } from 'react-router-dom';
import SubmitButton from '@/components/button/SubmitButton';
import DataGrid from '@/components/datagrid';
import Seo from '@/seo/Seo';
import { createColumns } from '@/utils/util';
import { initializeDuckDbWorker } from '@/utils/util.duckdb-init';
import { SnackbarContext } from '@/contexts/AlertContext';

// duckdb-wasm 바이너리는 lazy chunk로 분리해 초기 번들에 포함되지 않도록 함
const loadDuckDb = async () => {
  const duckdb = await import('@duckdb/duckdb-wasm');
  const [duckdbWasm, duckdbWasmEh, mvpWorker, ehWorker] = await Promise.all([
    import('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'),
    import('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'),
    import('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'),
    import('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'),
  ]);
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: duckdbWasm.default, mainWorker: mvpWorker.default },
    eh: { mainModule: duckdbWasmEh.default, mainWorker: ehWorker.default },
  });
  const worker = new Worker(bundle.mainWorker);
  try {
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await initializeDuckDbWorker(worker, () => db.instantiate(bundle.mainModule, bundle.pthreadWorker));
    return { duckdb, db };
  } catch (e) {
    worker.terminate();
    throw e;
  }
};

// echarts는 차트 탭 사용 시에만 로드 (lazy chunk)
const ReactECharts = lazy(() => import('echarts-for-react'));

const TABLE_NAME = 'uploaded_data';
const CHART_TYPES = ['bar', 'line', 'pie'];

// DuckDB는 BIGINT/DECIMAL 등을 BigInt로 반환 — toast-ui grid와 차트가 Number만 처리하므로 정규화
const ARROW_TYPE = { Int: 2, Float: 3, Decimal: 7 };
type ResultField = { name: string; type: { typeId: number; scale?: number } };
type QueryResult = {
  schema: { fields: ResultField[] };
  toArray: () => { toJSON: () => Record<string, unknown> }[];
};
const normalizeValue = (v: unknown, type?: ResultField['type']) => {
  if (typeof v === 'bigint') return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
  if (type?.typeId === ARROW_TYPE.Decimal && ArrayBuffer.isView(v)) {
    const unscaled = String(v);
    const negative = unscaled.startsWith('-');
    const digits = unscaled.replace(/^-/, '');
    const scale = type.scale || 0;
    const padded = digits.padStart(scale + 1, '0');
    const value =
      (negative ? '-' : '') +
      (scale > 0 ? `${padded.slice(0, -scale)}.${padded.slice(-scale)}` : digits + '0'.repeat(-scale));
    return Number.isSafeInteger(Number(value)) ? Number(value) : value;
  }
  return v;
};
const toRows = (result: QueryResult) => {
  const types = new Map(result.schema.fields.map(field => [field.name, field.type]));
  return result.toArray().map(r => {
    const row = { ...r.toJSON() };
    for (const k of Object.keys(row)) row[k] = normalizeValue(row[k], types.get(k));
    return row;
  });
};
const getNumericFields = (result: QueryResult) =>
  result.schema.fields
    .filter(field => [ARROW_TYPE.Int, ARROW_TYPE.Float, ARROW_TYPE.Decimal].includes(field.type.typeId))
    .map(field => field.name);
const chartValue = (value: unknown) =>
  typeof value === 'string' && Number.isSafeInteger(Number(value)) ? Number(value) : value;

const FileAnalysis = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [numericFields, setNumericFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const mountedRef = useRef(true);
  const [chartType, setChartType] = useState('bar');
  const [xField, setXField] = useState('');
  const [yField, setYField] = useState('');
  const duckDbRef = useRef<{ duckdb: any; db: any } | null>(null);

  const fieldNames = columns.map(column => column.name);
  const chartOption =
    data.length > 0 && xField && yField
      ? chartType === 'pie'
        ? {
            series: [
              {
                type: 'pie',
                data: data.slice(0, 100).map(r => ({ name: String(r[xField]), value: chartValue(r[yField]) })),
              },
            ],
            tooltip: { trigger: 'item' },
          }
        : {
            xAxis: { type: 'category', data: data.slice(0, 500).map(r => String(r[xField])) },
            yAxis: { type: 'value' },
            series: [{ type: chartType, data: data.slice(0, 500).map(r => chartValue(r[yField])) }],
            tooltip: { trigger: 'axis' },
          }
      : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      duckDbRef.current?.db.terminate();
      duckDbRef.current = null;
    };
  }, []);

  const applyResult = (result: QueryResult) => {
    const rows = toRows(result);
    const nextColumns = createColumns(rows);
    const names = nextColumns.map(column => column.name);
    const numeric = rows.length > 0 ? getNumericFields(result) : [];
    setData(rows);
    setColumns(nextColumns);
    setNumericFields(numeric);
    setXField(prev => (names.includes(prev) ? prev : names[0] || ''));
    setYField(prev => (numeric.includes(prev) ? prev : numeric[0] || ''));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || loading || saving) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'parquet', 'json'].includes(ext)) {
      alert.error(t('fileAnalysis.fileTypeError'));
      event.target.value = '';
      return;
    }
    setFileName(file.name);
    setSelectedFile(file);
    setAnalyzed(false);
    setData([]);
    setColumns([]);
    setNumericFields([]);
    setQuery('');
  };

  const analyzeFile = async () => {
    if (!selectedFile || loading || saving) return;
    const file = selectedFile;
    const ext = file.name.split('.').pop().toLowerCase();
    setLoading(true);
    if (!duckDbRef.current) {
      try {
        const instance = await loadDuckDb();
        if (!mountedRef.current) {
          await instance.db.terminate();
          return;
        }
        duckDbRef.current = instance;
      } catch (e) {
        if (!mountedRef.current) return;
        console.error(e);
        alert.error(t('fileAnalysis.engineFailed'));
        setLoading(false);
        return;
      }
    }
    const { duckdb, db } = duckDbRef.current;
    let conn;
    try {
      conn = await db.connect();
      await conn.query(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
      await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      const sqlFileName = file.name.replace(/'/g, "''");
      const readExpr =
        ext === 'parquet'
          ? `read_parquet('${sqlFileName}')`
          : ext === 'json'
          ? `read_json_auto('${sqlFileName}')`
          : `read_csv_auto('${sqlFileName}')`;
      await conn.query(`CREATE TABLE ${TABLE_NAME} AS SELECT * FROM ${readExpr}`);
      const preview = await conn.query(`SELECT * FROM ${TABLE_NAME} LIMIT 500`);
      applyResult(preview);
      setAnalyzed(true);
      setQuery(`SELECT * FROM ${TABLE_NAME} LIMIT 100`);
      snackbar.success(t('fileAnalysis.fileLoaded', { name: file.name }));
    } catch (e) {
      console.error(e);
      alert.error(t('fileAnalysis.loadFailed', { message: e.message || e }));
    } finally {
      try {
        await conn?.close();
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
  };

  const saveAsDataset = (destination?: 'builder' | 'ai') => {
    if (!selectedFile || loading || saving) return;
    setSaving(true);
    DatabaseService.uploadFile(selectedFile)
      .then(response => {
        if (response.data.status === 'SUCCESS') {
          snackbar.success(t('fileAnalysis.saved', { rows: response.data.data.rows }));
          navigate(
            destination === 'ai'
              ? `/dashboard?aiSourceId=${response.data.data.id}`
              : destination === 'builder'
              ? `/explore?sourceId=${response.data.data.id}`
              : `/data/set/create/${response.data.data.id}`,
            {
              state: { tableName: response.data.data.tableName },
            },
          );
        } else {
          alert.error(response.data.message || t('fileAnalysis.saveFailed'));
        }
      })
      .catch(error => {
        alert.error(error.message || t('fileAnalysis.saveFailed'));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const exportCsv = () => {
    if (data.length === 0) return;
    const names = columns.map(column => column.name);
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [names.map(escape).join(','), ...data.map(r => names.map(n => escape(r[n])).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^.]+$/, '') || 'result'}-result.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runQuery = async () => {
    if (!query.trim() || !analyzed || !duckDbRef.current || loading || saving) return;
    setLoading(true);
    let conn;
    try {
      conn = await duckDbRef.current.db.connect();
      const result = await conn.query(query);
      applyResult(result);
    } catch (e) {
      alert.error(t('fileAnalysis.queryFailed', { message: e.message || e }));
    } finally {
      try {
        await conn?.close();
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
  };

  return (
    <PageTitleBox
      upperTitle={t('common.data')}
      upperTitleLink="/data"
      title={t('common.fileAnalysis')}
      sx={{ p: 0, width: '100%', height: '100%' }}
    >
      <Seo title={t('common.fileAnalysis')} />
      <Stack spacing="20px" sx={{ p: { xs: '24px 16px', sm: '30px 25px 40px 25px' }, minWidth: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          sx={{
            flexWrap: 'wrap',
            gap: 2,
            p: '16px 20px',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: '8px',
            bgcolor: 'background.default',
          }}
        >
          <Typography sx={{ fontSize: '14px', color: '#555' }}>{t('fileAnalysis.description')}</Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.parquet,.json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            variant="contained"
            disabled={loading || saving}
            onClick={() => fileInputRef.current?.click()}
            sx={{ flexShrink: 0 }}
          >
            {t('fileAnalysis.selectFile')}
          </Button>
          {fileName && (
            <Typography sx={{ fontSize: '13px', color: 'text.secondary', overflowWrap: 'anywhere', minWidth: 0 }}>
              {fileName}
              {analyzed && (
                <>
                  {' '}
                  → <b>{TABLE_NAME}</b> {t('fileAnalysis.tableLabel')}
                </>
              )}
            </Typography>
          )}
        </Stack>

        {selectedFile && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
            <Button variant="contained" onClick={() => saveAsDataset()} disabled={saving || loading}>
              {saving ? t('fileAnalysis.saving') : t('fileAnalysis.saveDataset')}
            </Button>
            <Button variant="outlined" onClick={() => saveAsDataset('builder')} disabled={saving || loading}>
              {t('fileAnalysis.buildChart')}
            </Button>
            <Button variant="outlined" onClick={() => saveAsDataset('ai')} disabled={saving || loading}>
              {t('fileAnalysis.buildWithAi')}
            </Button>
            <Button variant="outlined" onClick={analyzeFile} disabled={loading || saving}>
              {loading ? t('fileAnalysis.processing') : t('fileAnalysis.analyzeBrowser')}
            </Button>
          </Stack>
        )}

        {analyzed && (
          <>
            <TextField
              size="small"
              fullWidth
              placeholder={t('fileAnalysis.queryPlaceholder', { table: TABLE_NAME })}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') runQuery();
              }}
              sx={{ backgroundColor: '#fff' }}
            />
            <SubmitButton
              label={t('fileAnalysis.run')}
              type="button"
              size="large"
              sx={{ width: '100%', maxWidth: '374px', fontSize: '13px' }}
              onClick={runQuery}
              disabled={loading || saving}
            />
          </>
        )}

        {data.length > 0 && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>{t('fileAnalysis.chart')}</InputLabel>
              <Select value={chartType} label={t('fileAnalysis.chart')} onChange={e => setChartType(e.target.value)}>
                {CHART_TYPES.map(type => (
                  <MenuItem key={type} value={type}>
                    {t(`fileAnalysis.chartType.${type}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>{t('fileAnalysis.xAxis')}</InputLabel>
              <Select value={xField} label={t('fileAnalysis.xAxis')} onChange={e => setXField(e.target.value)}>
                {fieldNames.map(f => (
                  <MenuItem key={f} value={f}>
                    {f}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>{t('fileAnalysis.value')}</InputLabel>
              <Select value={yField} label={t('fileAnalysis.value')} onChange={e => setYField(e.target.value)}>
                {numericFields.map(f => (
                  <MenuItem key={f} value={f}>
                    {f}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" onClick={exportCsv} sx={{ flexShrink: 0 }}>
              {t('fileAnalysis.exportCsv')}
            </Button>
          </Stack>
        )}

        {chartOption && (
          <Suspense
            fallback={<Typography sx={{ fontSize: '13px', color: '#767676' }}>{t('fileAnalysis.chartLoading')}</Typography>}
          >
            <ReactECharts option={chartOption} style={{ height: 360, width: '100%' }} />
          </Suspense>
        )}

        {data.length > 0 && (
          <Box sx={{ backgroundColor: '#f5f6f8', p: '20px 0' }}>
            <DataGrid
              minBodyHeight={300}
              bodyHeight={500}
              data={data}
              columns={columns}
              columnOptions={{ resizable: true }}
            />
          </Box>
        )}
      </Stack>
    </PageTitleBox>
  );
};

export default FileAnalysis;
