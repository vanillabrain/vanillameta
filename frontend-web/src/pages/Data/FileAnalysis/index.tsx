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
  const db = new duckdb.AsyncDuckDB(null, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return { duckdb, db };
};

// echarts는 차트 탭 사용 시에만 로드 (lazy chunk)
const ReactECharts = lazy(() => import('echarts-for-react'));

const TABLE_NAME = 'uploaded_data';
const CHART_TYPES = ['bar', 'line', 'pie'];

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
  const [loading, setLoading] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [chartType, setChartType] = useState('bar');
  const [xField, setXField] = useState('');
  const [yField, setYField] = useState('');
  const duckDbRef = useRef<{ duckdb: any; db: any } | null>(null);

  const fieldNames = data.length > 0 ? Object.keys(data[0]) : [];
  const numericFields = fieldNames.filter(f => typeof data[0][f] === 'number');
  const chartOption =
    xField && yField
      ? chartType === 'pie'
        ? {
            series: [
              {
                type: 'pie',
                data: data.slice(0, 100).map(r => ({ name: String(r[xField]), value: r[yField] })),
              },
            ],
            tooltip: { trigger: 'item' },
          }
        : {
            xAxis: { type: 'category', data: data.slice(0, 500).map(r => String(r[xField])) },
            yAxis: { type: 'value' },
            series: [{ type: chartType, data: data.slice(0, 500).map(r => r[yField]) }],
            tooltip: { trigger: 'axis' },
          }
      : null;

  useEffect(() => {
    // 페이지 진입 시 WASM 엔진을 미리 로딩
    loadDuckDb()
      .then(instance => {
        duckDbRef.current = instance;
        setEngineReady(true);
      })
      .catch(e => {
        console.error(e);
        alert.error(t('fileAnalysis.engineFailed'));
      });
    return () => {
      duckDbRef.current?.db?.terminate();
    };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { duckdb, db } = duckDbRef.current;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'parquet', 'json'].includes(ext)) {
      alert.error(t('fileAnalysis.fileTypeError'));
      return;
    }
    setLoading(true);
    try {
      const conn = await db.connect();
      await conn.query(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
      await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      const readExpr =
        ext === 'parquet'
          ? `read_parquet('${file.name}')`
          : ext === 'json'
          ? `read_json_auto('${file.name}')`
          : `read_csv_auto('${file.name}')`;
      await conn.query(`CREATE TABLE ${TABLE_NAME} AS SELECT * FROM ${readExpr}`);
      const preview = await conn.query(`SELECT * FROM ${TABLE_NAME} LIMIT 500`);
      const rows = preview.toArray().map(r => r.toJSON());
      setData(rows);
      setColumns(createColumns(rows));
      if (rows.length > 0) {
        const names = Object.keys(rows[0]);
        const numeric = names.filter(f => typeof rows[0][f] === 'number');
        setXField(prev => (names.includes(prev) ? prev : names[0]));
        setYField(prev => (numeric.includes(prev) ? prev : numeric[0] || ''));
      }
      setFileName(file.name);
      setSelectedFile(file);
      setQuery(`SELECT * FROM ${TABLE_NAME} LIMIT 100`);
      snackbar.success(t('fileAnalysis.fileLoaded', { name: file.name }));
      await conn.close();
    } catch (e) {
      console.error(e);
      alert.error(t('fileAnalysis.loadFailed', { message: e.message || e }));
    } finally {
      setLoading(false);
    }
  };

  const saveAsDataset = () => {
    if (!selectedFile) return;
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (ext === 'parquet') {
      alert.error(t('fileAnalysis.saveParquetError'));
      return;
    }
    setSaving(true);
    DatabaseService.uploadFile(selectedFile)
      .then(response => {
        if (response.data.status === 'SUCCESS') {
          snackbar.success(t('fileAnalysis.saved', { rows: response.data.data.rows }));
          navigate(`/data/set/create/${response.data.data.id}`, { state: { tableName: 'uploaded_data' } });
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
    const names = Object.keys(data[0]);
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [names.join(','), ...data.map(r => names.map(n => escape(r[n])).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^.]+$/, '') || 'result'}-result.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runQuery = async () => {
    if (!query.trim() || !duckDbRef.current) return;
    setLoading(true);
    try {
      const conn = await duckDbRef.current.db.connect();
      const result = await conn.query(query);
      const rows = result.toArray().map(r => r.toJSON());
      setData(rows);
      setColumns(createColumns(rows));
      if (rows.length > 0) {
        const names = Object.keys(rows[0]);
        const numeric = names.filter(f => typeof rows[0][f] === 'number');
        setXField(prev => (names.includes(prev) ? prev : names[0]));
        setYField(prev => (numeric.includes(prev) ? prev : numeric[0] || ''));
      }
      await conn.close();
    } catch (e) {
      alert.error(t('fileAnalysis.queryFailed', { message: e.message || e }));
    } finally {
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
      <Stack spacing="20px" sx={{ p: '30px 25px 40px 25px' }}>
        <Stack
          direction="row"
          spacing="16px"
          alignItems="center"
          sx={{ p: '16px 20px', border: '1px dashed #c9d2e0', borderRadius: '8px', backgroundColor: '#f7f9fc' }}
        >
          <Typography sx={{ fontSize: '14px', color: '#555' }}>
            {t('fileAnalysis.description')}
            {!engineReady && ` ${t('fileAnalysis.engineLoading')}`}
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.parquet,.json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <Button
            variant="contained"
            disabled={!engineReady || loading}
            onClick={() => fileInputRef.current?.click()}
            sx={{ flexShrink: 0 }}
          >
            {loading ? t('fileAnalysis.processing') : t('fileAnalysis.selectFile')}
          </Button>
          {fileName && (
            <Typography sx={{ fontSize: '13px', color: '#767676' }}>
              {fileName} → <b>{TABLE_NAME}</b> {t('fileAnalysis.tableLabel')}
            </Typography>
          )}
        </Stack>

        {fileName && (
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
              sx={{ width: '374px', fontSize: '13px' }}
              onClick={runQuery}
              disabled={loading}
            />
          </>
        )}

        {data.length > 0 && (
          <Stack direction="row" spacing="16px" alignItems="center">
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
            <Button size="small" variant="contained" onClick={saveAsDataset} disabled={saving} sx={{ flexShrink: 0 }}>
              {saving ? t('fileAnalysis.saving') : t('fileAnalysis.saveDataset')}
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
