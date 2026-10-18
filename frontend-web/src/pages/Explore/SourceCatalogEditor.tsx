import SourceCatalogUsage from './SourceCatalogUsage';
import SourceCatalogChanges, { CatalogChange } from './SourceCatalogChanges';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SourceCatalogHistory from './SourceCatalogHistory';
import React, { useEffect, useId, useRef, useState } from 'react';
import { post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Notice } from '@/components/ui/notice';

type BusinessColumn = { column: string; type: string; label: string; description: string; unit: string };
type Catalog = {
  sourceId: number;
  sourceRevision: string;
  version: number;
  label: string;
  description: string;
  schemaChanged: boolean;
  columns: BusinessColumn[];
};
type Draft = Omit<Catalog, 'schemaChanged' | 'columns'> & { columns: Array<Omit<BusinessColumn, 'type'>> };
type Preview = { draft: Draft; changes: CatalogChange[] };
const payload = (data: Catalog): Draft => ({
  sourceId: data.sourceId,
  sourceRevision: data.sourceRevision,
  version: data.version,
  label: data.label,
  description: data.description,
  columns: data.columns.map(({ column, label, description, unit }) => ({ column, label, description, unit })),
});
const unwrap = (response: any): Catalog => {
  if (response?.data?.status !== 'SUCCESS' || !response.data.data) throw new Error('invalid response');
  return response.data.data;
};

/** Source identity owns editor state; an old request can never populate another source. */
type AccessProps = { sourceId: number; canEdit?: boolean; canInspectUsage?: boolean };
export default function SourceCatalogEditor({ sourceId, canEdit = true, canInspectUsage = true }: AccessProps) {
  return (
    <Editor
      key={`${sourceId}:${canEdit}:${canInspectUsage}`}
      sourceId={sourceId}
      canEdit={canEdit}
      canInspectUsage={canInspectUsage}
    />
  );
}
function Editor({ sourceId, canEdit = true, canInspectUsage = true }: AccessProps) {
  const panelId = useId();
  const live = useRef(true);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Catalog | null>(null);
  const [baseline, setBaseline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmReload, setConfirmReload] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [agreed, setAgreed] = useState(false);
  const clearPreview = () => {
    setPreview(null);
    setAgreed(false);
  };
  const dirty = data !== null && JSON.stringify(data) !== baseline;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const read = async () => {
    clearPreview();
    setConfirmReload(false);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = unwrap(await post('/bi/source-catalog/read', { sourceId }));
      if (!live.current) return;
      setData(next);
      setBaseline(JSON.stringify(next));
    } catch (failure) {
      if (live.current)
        setError(
          failure?.response?.status === 409
            ? '저장 이력을 확인할 수 없습니다. 데이터 담당자의 확인이 필요합니다.'
            : '업무 설명을 불러오지 못했습니다. 다시 시도해 주세요.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const buildPreview = async () => {
    if (!canEdit || !data || busy || data.schemaChanged) return;
    clearPreview();
    setBusy(true);
    setError('');
    setNotice('');
    setConfirmReload(false);
    try {
      const response = await post('/bi/source-catalog/preview', payload(data));
      const next = response?.data?.data as Preview;
      if (
        response?.data?.status !== 'SUCCESS' ||
        !next?.draft ||
        !Array.isArray(next.changes) ||
        next.draft.sourceId !== sourceId ||
        next.draft.version !== data.version ||
        next.draft.sourceRevision !== data.sourceRevision
      )
        throw new Error('invalid preview');
      if (
        next.changes.some(change => {
          const candidate =
            change.column === null ? next.draft : next.draft.columns.find(column => column.column === change.column);
          const allowed = change.column === null ? ['label', 'description'] : ['label', 'description', 'unit'];
          return (
            !allowed.includes(change.field) ||
            !candidate ||
            typeof change.after !== 'string' ||
            candidate[change.field] !== change.after
          );
        })
      )
        throw new Error('inconsistent preview');
      if (live.current) {
        setPreview(next);
        // A server-confirmed normalized no-op needs no save or input replacement.
        if (next.changes.length === 0) setBaseline(JSON.stringify(data));
      }
    } catch (failure) {
      if (live.current)
        setError(
          failure?.response?.status === 400
            ? '표시명·설명·단위를 확인해 주세요. 중복 표시명과 빈 이름은 사용할 수 없습니다.'
            : failure?.response?.status === 409
            ? '다른 창 또는 데이터가 변경됐습니다. 입력을 보존했습니다. 최신 설명을 다시 확인해 주세요.'
            : '변경 내용을 확인하지 못했습니다. 입력을 보존했습니다. 미리보기를 다시 시도해 주세요.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const save = async () => {
    if (!canEdit || !data || busy || data.schemaChanged || !preview || !agreed || !preview.changes.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    setConfirmReload(false);
    try {
      const next = unwrap(await post('/bi/source-catalog/save', preview.draft));
      if (!live.current) return;
      setData(next);
      setBaseline(JSON.stringify(next));
      setNotice('업무 설명을 저장했습니다.');
      clearPreview();
    } catch (failure) {
      if (!live.current) return;
      clearPreview();
      setError(
        failure?.response?.status === 400
          ? '입력 검증에 실패해 저장하지 않았습니다. 변경 내용을 다시 확인해 주세요.'
          : failure?.response?.status === 409
          ? '다른 창 또는 데이터가 변경됐습니다. 입력을 보존했습니다. 최신 설명을 다시 확인해 주세요.'
          : '저장을 확인하지 못했습니다. 입력을 보존했습니다. 최신 설명을 읽어 반영 여부를 확인해 주세요.',
      );
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const change = (next: Catalog) => {
    clearPreview();
    setData(next);
    setNotice('');
    setConfirmReload(false);
  };
  return (
    <section className="my-3 min-w-0 rounded-lg border border-border" aria-label="데이터 업무 설명 편집">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="m-2 max-w-[calc(100%-1rem)]"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={busy}
        onClick={() => {
          setOpen(!open);
          if (!open && !data) void read();
        }}
      >
        데이터 업무 설명
      </Button>
      {open && (
        <div id={panelId} className="min-w-0 space-y-3 border-t border-border p-3">
          <p className="text-xs text-muted-foreground">
            원본 열·계산식은 유지하고 업무 의미만 기록합니다. 공식 승인이나 기존 분석 자동 변경은 포함하지 않습니다.
          </p>
          {busy && (
            <p role="status" className="text-sm">
              처리 중입니다…
            </p>
          )}
          {error && <Notice severity="error">{error}</Notice>}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          {data?.schemaChanged && (
            <Notice severity="warning">
              열 구조가 변경되어 저장을 잠갔습니다. 기존 설명 이력은 보존되며 구조 재연결은 별도 확인이 필요합니다.
            </Notice>
          )}
          {data && (
            <fieldset disabled={!canEdit || busy || data.schemaChanged} className="min-w-0 space-y-3">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="소스 표시명"
                  value={data.label}
                  maxLength={100}
                  onChange={e => change({ ...data, label: e.target.value })}
                />
                <TextField
                  label="소스 업무 설명"
                  value={data.description}
                  maxLength={1000}
                  onChange={e => change({ ...data, description: e.target.value })}
                />
              </div>
              <ul className="min-w-0 space-y-3">
                {data.columns.map((column, index) => {
                  const update = (key: 'label' | 'description' | 'unit', value: string) =>
                    change({ ...data, columns: data.columns.map((c, i) => (i === index ? { ...c, [key]: value } : c)) });
                  return (
                    <li key={column.column} className="min-w-0 rounded-md border border-border p-3">
                      <p className="mb-2 text-xs break-words text-muted-foreground">
                        {column.column} · {column.type}
                      </p>
                      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
                        <TextField
                          label={`${column.column} 표시명`}
                          value={column.label}
                          maxLength={100}
                          onChange={e => update('label', e.target.value)}
                        />
                        <TextField
                          label={`${column.column} 업무 설명`}
                          value={column.description}
                          maxLength={1000}
                          onChange={e => update('description', e.target.value)}
                        />
                        <TextField
                          label={`${column.column} 단위`}
                          value={column.unit}
                          maxLength={24}
                          onChange={e => update('unit', e.target.value)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {data && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canEdit || busy || !dirty || data.schemaChanged}
                  onClick={() => void buildPreview()}
                >
                  변경 내용 미리보기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canEdit || busy || !preview || !agreed || !preview.changes.length || data.schemaChanged}
                  onClick={() => void save()}
                >
                  확인한 변경 저장
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => (dirty ? setConfirmReload(true) : void read())}
            >
              {data ? '최신 설명 다시 읽기' : '업무 설명 다시 읽기'}
            </Button>
            {data && (
              <span className="text-xs text-muted-foreground">
                설명 버전 {data.version}
                {dirty ? ' · 미저장 변경' : ''}
              </span>
            )}
          </div>
          {preview && (
            <section
              className="min-w-0 space-y-3 rounded-md border border-border p-3"
              aria-label="저장 전 업무 설명 미리보기"
            >
              <p role="status" className="text-sm font-medium">
                저장 전 변경 {preview.changes.length}개
              </p>
              <p className="text-xs text-muted-foreground">
                아직 저장하지 않았습니다. 원본 열·계산식과 기존 분석은 바뀌지 않습니다.
              </p>
              {preview.changes.length === 0 ? (
                <p className="text-sm">저장할 업무 설명 변경이 없습니다.</p>
              ) : (
                <>
                  <SourceCatalogChanges
                    changes={preview.changes}
                    beforeLabel={data?.version === 0 ? '현재 기본값' : '현재 저장본'}
                    afterLabel="저장할 내용"
                  />
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={`${panelId}-agree`}
                      checked={agreed}
                      disabled={busy}
                      onCheckedChange={value => setAgreed(value === true)}
                    />
                    <Label htmlFor={`${panelId}-agree`} className="text-sm">
                      표시한 변경 내용을 확인했습니다
                    </Label>
                  </div>
                </>
              )}
            </section>
          )}
          {canInspectUsage && <SourceCatalogUsage sourceId={sourceId} />}
          <SourceCatalogHistory sourceId={sourceId} savedVersion={data?.version ?? 0} />
          {confirmReload && (
            <div className="space-y-2" role="group" aria-label="미저장 설명 교체 확인">
              <p className="text-sm">다시 읽으면 현재 입력을 최신 저장 내용으로 바꿉니다.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void read()}>
                  내 입력을 버리고 최신 설명 읽기
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmReload(false)}>
                  입력 유지
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
