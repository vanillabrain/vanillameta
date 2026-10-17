import React, { useRef, useState } from 'react';
import StudioSourceCatalog from './StudioSourceCatalog';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { SourceProfile, StudioSource } from './studioCreation';
type Props = {
  idPrefix?: string;
  sources: StudioSource[];
  sourceId: number | null;
  profile: SourceProfile | null;
  busy: boolean;
  onSource: (id: number) => void;
  onFile: (file: File) => void;
  onSample: (sample: 'rill' | 'commerce') => void;
  onRefresh: () => void;
};
export default function StudioSourcePicker({
  idPrefix = 'studio',
  sources,
  sourceId,
  profile,
  busy,
  onSource,
  onFile,
  onSample,
  onRefresh,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().trim();
  const query = searchOpen ? normalize(search) : '';
  const matches = sources.filter(source =>
    normalize(`${source.catalogLabel ?? ''} ${source.name} #${source.id}`).includes(query),
  );
  const matchIds = new Set(matches.map(source => source.id));
  const options = sources.filter(source => source.id === sourceId || matchIds.has(source.id));
  return (
    <section className="studio-create-source" aria-labelledby={idPrefix + '-source-heading'}>
      <span className="studio-eyebrow">01 · 데이터 준비</span>
      <h2 id={idPrefix + '-source-heading'}>어떤 데이터를 살펴볼까요?</h2>
      <p>내 파일을 서버에 저장하거나, 기존 데이터와 검증된 샘플로 시작하세요.</p>
      <div className="studio-create-source-actions">
        <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          파일 선택
        </Button>
        <input
          ref={input}
          type="file"
          hidden
          aria-label="CSV·JSON·Parquet 파일"
          accept=".csv,.json,.parquet"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = '';
          }}
        />
        <Button variant="outline" disabled={busy} onClick={() => onSample('commerce')}>
          매출·환불 샘플
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => onSample('rill')}>
          Rill 광고 샘플
        </Button>
      </div>
      <p className="studio-create-sample-credit">
        매출·환불 샘플은 Analytics Engineering의 공개 합성 데이터입니다.{' '}
        <a href="https://www.analyticsengineering.com/datasets/ecommerce-sales" target="_blank" rel="noreferrer">
          출처 · CC BY 4.0
        </a>
      </p>
      <div className="min-w-0 space-y-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          aria-expanded={searchOpen}
          aria-controls={idPrefix + '-source-search'}
          onClick={() => setSearchOpen(!searchOpen)}
        >
          데이터 검색
        </Button>
        {searchOpen && (
          <div id={idPrefix + '-source-search'} className="min-w-0 space-y-2">
            <TextField
              label="업무 이름·원본 이름으로 검색"
              value={search}
              disabled={busy}
              onChange={event => setSearch(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              업무 이름은 목록 조회 시점의 안내입니다. 최신 설명은 데이터 선택 후 확인하세요.
            </p>
            <p role="status" className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              검색 결과 {matches.length}개
              {sourceId && !matches.some(source => source.id === sourceId) ? ' · 현재 선택한 데이터는 유지됩니다.' : ''}
            </p>
          </div>
        )}
      </div>
      <TextField
        select
        label="저장된 데이터"
        value={sourceId ?? ''}
        onChange={event => onSource(Number(event.target.value))}
        disabled={busy}
      >
        <option value="" disabled>
          데이터를 선택하세요
        </option>
        {options.map(source => (
          <option key={source.id} value={source.id} disabled={source.engine !== 'duckdb'}>
            {source.catalogLabel ? `${source.catalogLabel} · ${source.name}` : source.name} · #{source.id}
            {source.engine !== 'duckdb' ? ' · Studio 미지원' : ''}
          </option>
        ))}
      </TextField>
      {sourceId && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={onRefresh}>
          소스 새로 확인
        </Button>
      )}
      {profile && (
        <div className="studio-create-profile">
          <strong>{profile.name ?? '선택한 데이터'}</strong>
          <span>
            {Number(profile.rowCount).toLocaleString()}행 · {profile.columns.length}개 열 · 서버 DuckDB
          </span>
          <div className="studio-create-columns" aria-label="소스 열" role="region" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th>열</th>
                  <th>형식</th>
                  <th>빈 값</th>
                </tr>
              </thead>
              <tbody>
                {profile.columns.map(column => (
                  <tr key={column.name}>
                    <td>{column.name}</td>
                    <td>{column.type}</td>
                    <td>{column.nullCount ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {profile && profile.sourceId === sourceId && <StudioSourceCatalog profile={profile} />}
    </section>
  );
}
