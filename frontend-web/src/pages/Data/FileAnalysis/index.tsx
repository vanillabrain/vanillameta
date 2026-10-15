import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';

import PageTitleBox from '@/components/PageTitleBox';
import SubmitButton from '@/components/button/SubmitButton';
import DataGrid from '@/components/datagrid';
import Seo from '@/seo/Seo';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import DatabaseService from '@/api/databaseService';
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

// DuckDB는 BIGINT/DECIMAL 등을 BigInt로 반환 — 차트와 grid가 Number만 처리하므로 정규화
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
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
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
      className="h-full w-full p-0"
    >
      <Seo title={t('common.fileAnalysis')} />
      <div className="flex min-w-0 flex-col gap-5 py-6 px-4 sm:px-6.25 sm:pt-7.5 sm:pb-10">
        <div className="flex flex-row flex-wrap items-center gap-4 rounded-lg border border-dashed border-border bg-muted py-4 px-5">
          <span className="text-sm text-[#555]">{t('fileAnalysis.description')}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.parquet,.json"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button disabled={loading || saving} onClick={() => fileInputRef.current?.click()} className="shrink-0">
            {t('fileAnalysis.selectFile')}
          </Button>
          {fileName && (
            <span className="min-w-0 text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
              {fileName}
              {analyzed && (
                <>
                  {' '}
                  → <b>{TABLE_NAME}</b> {t('fileAnalysis.tableLabel')}
                </>
              )}
            </span>
          )}
        </div>

        {selectedFile && (
          <div className="flex flex-row flex-wrap gap-4">
            <Button onClick={() => saveAsDataset()} disabled={saving || loading}>
              {saving ? t('fileAnalysis.saving') : t('fileAnalysis.saveDataset')}
            </Button>
            <Button variant="outline" onClick={() => saveAsDataset('builder')} disabled={saving || loading}>
              {t('fileAnalysis.buildChart')}
            </Button>
            <Button variant="outline" onClick={() => saveAsDataset('ai')} disabled={saving || loading}>
              {t('fileAnalysis.buildWithAi')}
            </Button>
            <Button variant="outline" onClick={analyzeFile} disabled={loading || saving}>
              {loading ? t('fileAnalysis.processing') : t('fileAnalysis.analyzeBrowser')}
            </Button>
          </div>
        )}

        {analyzed && (
          <>
            <TextField
              className="min-w-0"
              placeholder={t('fileAnalysis.queryPlaceholder', { table: TABLE_NAME })}
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') runQuery();
              }}
              inputProps={{ 'aria-label': t('dataset.sqlQuery'), className: 'bg-white' }}
            />
            <SubmitButton
              label={t('fileAnalysis.run')}
              type="button"
              size="large"
              className="w-full max-w-[374px] text-[13px]"
              onClick={runQuery}
              disabled={loading || saving}
            />
          </>
        )}

        {data.length > 0 && (
          <div className="flex flex-row flex-wrap items-center gap-4">
            <TextField
              select
              label={t('fileAnalysis.chart')}
              value={chartType}
              onChange={event => setChartType(event.target.value)}
              className="w-[110px] shrink-0"
            >
              {CHART_TYPES.map(type => (
                <option key={type} value={type}>
                  {t(`fileAnalysis.chartType.${type}`)}
                </option>
              ))}
            </TextField>
            <TextField
              select
              label={t('fileAnalysis.xAxis')}
              value={xField}
              onChange={event => setXField(event.target.value)}
              className="w-[160px] shrink-0"
            >
              {fieldNames.map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </TextField>
            <TextField
              select
              label={t('fileAnalysis.value')}
              value={yField}
              onChange={event => setYField(event.target.value)}
              className="w-[160px] shrink-0"
            >
              {numericFields.map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </TextField>
            <Button size="sm" variant="outline" onClick={exportCsv} className="shrink-0">
              {t('fileAnalysis.exportCsv')}
            </Button>
          </div>
        )}

        {chartOption && (
          <Suspense fallback={<span className="text-[13px] text-[#767676]">{t('fileAnalysis.chartLoading')}</span>}>
            {/* echarts-for-react는 컨테이너 높이를 inline style로 강제하므로 차트 크기는 style API를 유지한다. */}
            <ReactECharts option={chartOption} style={{ height: 360, width: '100%' }} />
          </Suspense>
        )}

        {data.length > 0 && (
          <div className="bg-[#f5f6f8] py-5 px-0">
            <DataGrid
              minBodyHeight={300}
              bodyHeight={500}
              data={data}
              columns={columns}
              columnOptions={{ resizable: true }}
            />
          </div>
        )}
      </div>
    </PageTitleBox>
  );
};

export default FileAnalysis;
