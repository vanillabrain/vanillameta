import React from 'react';
import { Button } from '@/components/ui/button';
import { StudioDocumentV1 } from './studioTypes';
import { studioDateRangeSummary, studioFilterSummary } from './studioDocument';

type Props = { document: StudioDocumentV1; evidence: unknown; unverifiedAi?: boolean; saved?: boolean };
const canonical = (v: any): any =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === 'object'
    ? Object.fromEntries(
        Object.keys(v)
          .sort()
          .map(k => [k, canonical(v[k])]),
      )
    : v;
const queryOf = (document: StudioDocumentV1) => ({
  filters: document.filters ?? [],
  dateRange: document.dateRange ?? null,
  blocks: document.blocks.map(block => ({
    id: block.id,
    definitionKey: block.definitionKey,
    kind: block.kind,
    measureRefs: block.measureRefs,
    dimensionRefs: block.dimensionRefs,
    timeGrain: block.display.timeGrain ?? 'auto',
  })),
});
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const supported = ['SUM', 'AVG', 'COUNT', 'COUNT_DISTINCT', 'MIN', 'MAX', 'RATIO_SUM', 'WEIGHTED_AVG'];
const shortText = (v: unknown) => typeof v === 'string' && v.length <= 300;
const formula = (c: any): string | null => {
  if (c?.aggregation === 'FORMULA')
    return typeof c.expressionLabel === 'string' &&
      c.expressionLabel.length > 0 &&
      c.expressionLabel.length <= 4000 &&
      shortText(c.unit)
      ? `${c.expressionLabel} · ${c.unit || '단위 없음'}`
      : null;
  if (!c || !supported.includes(c.aggregation) || !shortText(c.column) || !shortText(c.unit)) return null;
  if (c.aggregation === 'RATIO_SUM') {
    if (!shortText(c.denominatorColumn) || ![1, 100].includes(c.scale)) return null;
    return `SUM(${c.column}) / SUM(${c.denominatorColumn}) × ${c.scale} · ${c.unit || '단위 없음'}`;
  }
  if (c.aggregation === 'WEIGHTED_AVG') {
    if (!shortText(c.weightColumn)) return null;
    return `가중평균(${c.column}, ${c.weightColumn}) · ${c.unit || '단위 없음'}`;
  }
  return `${c.aggregation}(${c.column}) · ${c.unit || '단위 없음'}`;
};
/** Owner-only, read-only projection. Unknown/old/AI evidence is never silently upgraded to verified. */
export default function StudioEvidence({ document, evidence, unverifiedAi = false, saved = false }: Props) {
  const e = evidence as any;
  const valid =
    e?.schemaVersion === 1 &&
    e.source?.id === document.sourceId &&
    [e.source?.revision, e.source?.schemaVersion, e.source?.dataVersion].every(hash) &&
    (e.documentRevision === null || hash(e.documentRevision)) &&
    typeof e.queriedAt === 'string' &&
    e.queriedAt.length <= 40 &&
    Number.isFinite(Date.parse(e.queriedAt)) &&
    Array.isArray(e.blocks) &&
    e.blocks.length === document.blocks.length &&
    e.blocks.every(
      (block: any, i: number) =>
        block?.blockId === document.blocks[i].id &&
        same(block.measureRefs, document.blocks[i].measureRefs) &&
        ((block.resultStatus === 'unavailable' && block.aggregateRowCount === null) ||
          (block.resultStatus === 'available' &&
            Number.isSafeInteger(block.aggregateRowCount) &&
            block.aggregateRowCount >= 0)),
    );
  const matches = valid && same(e.query, queryOf(document));
  const reason = unverifiedAi
    ? 'AI 수정 결과의 실행 근거는 아직 연결되지 않았습니다. 저장 후 다시 조회해 주세요.'
    : !valid
    ? '이 결과에 확인 가능한 실행 근거가 없습니다. 다시 조회한 결과에서 확인해 주세요.'
    : !matches
    ? '현재 편집 조건과 다릅니다. 현재 조건으로 다시 조회한 뒤 근거를 확인해 주세요.'
    : null;
  return (
    <details className="studio-evidence">
      <summary>
        계산 근거 · 데이터 시점{' '}
        <span>
          {reason
            ? '확인 필요'
            : e.blocks.some((block: any) => block.resultStatus === 'unavailable')
            ? '일부 집계 확인 필요'
            : '조회 결과 기준'}
        </span>
      </summary>
      <div className="studio-evidence-content">
        <Button variant="outline" size="sm" asChild>
          <a href={`/explore?sourceId=${document.sourceId}`} target="_blank" rel="noopener noreferrer">
            데이터 소스 확인·갱신 ↗
          </a>
        </Button>
        <p>새 탭에서 소스를 관리합니다. 갱신 후 이 화면을 다시 조회해야 최신 데이터가 반영됩니다.</p>
        {reason ? (
          <p role="status">{reason}</p>
        ) : (
          <>
            <p>현재 화면 숫자의 조회 근거입니다. 원본 파일의 마지막 갱신 성공 시각이나 영구 실행 이력을 뜻하지 않습니다.</p>
            <dl className="studio-evidence-meta">
              <div>
                <dt>데이터 소스</dt>
                <dd>#{e.source.id}</dd>
              </div>
              <div>
                <dt>조회 완료 시각 (UTC)</dt>
                <dd>
                  <time dateTime={e.queriedAt}>{new Date(e.queriedAt).toISOString().replace('T', ' ').slice(0, 19)}</time>
                </dd>
              </div>
              <div>
                <dt>조회 기간</dt>
                <dd>{document.dateRange ? studioDateRangeSummary(document.dateRange) : '전체 기간 · 시간대 UTC'}</dd>
              </div>
              <div>
                <dt>공통 필터</dt>
                <dd>{document.filters?.length ? studioFilterSummary(document.filters) : '없음'}</dd>
              </div>
            </dl>
            <details className="studio-evidence-versions">
              <summary>버전 식별자 자세히 보기</summary>
              <dl className="studio-evidence-meta">
                <div>
                  <dt>저장 기준 버전</dt>
                  <dd>{e.documentRevision ?? '미저장'}</dd>
                </div>
                <div>
                  <dt>소스 버전</dt>
                  <dd>{e.source.revision}</dd>
                </div>
                <div>
                  <dt>스키마 버전</dt>
                  <dd>{e.source.schemaVersion}</dd>
                </div>
                <div>
                  <dt>데이터 식별 버전</dt>
                  <dd>{e.source.dataVersion}</dd>
                </div>
              </dl>
            </details>
            <ul className="studio-evidence-blocks">
              {document.blocks.map((block, i) => {
                const item = e.blocks[i];
                const calculation = formula(item.calculation);
                return (
                  <li key={block.id}>
                    <strong>{block.title}</strong>
                    {saved &&
                      document.dashboardId &&
                      document.revision === e.documentRevision &&
                      block.kind !== 'CHART_LINE' &&
                      block.measureRefs.length === 1 &&
                      block.dimensionRefs.length <= 1 &&
                      document.dateRange?.precision !== 'timestamp' &&
                      item.resultStatus === 'available' &&
                      calculation && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            target="_blank"
                            rel="noopener noreferrer"
                            href={
                              '/explore/source?' +
                              new URLSearchParams({
                                sourceId: String(document.sourceId),
                                studioDashboard: String(document.dashboardId),
                                studioBlock: block.id,
                                studioRevision: document.revision ?? '',
                                sourceRevision: e.source.revision,
                              }).toString()
                            }
                          >
                            같은 조건으로 탐색 ↗
                          </a>
                        </Button>
                      )}

                    <span>{calculation ?? '구조화 계산 근거 없음 · 기존 SQL 정의를 추측하지 않습니다.'}</span>
                    {item.measureRefs.map((ref: any) => (
                      <span key={ref.id}>
                        저장 지표 #{ref.id} · 정의 v{ref.definitionVersion}
                      </span>
                    ))}
                    <span>
                      {item.resultStatus === 'unavailable'
                        ? '요청한 집계의 결과 확인 불가 · 해당 블록의 제한 안내를 확인해 주세요.'
                        : `반환된 집계 결과 ${item.aggregateRowCount}행 · 원본 행 수와 다릅니다.`}{' '}
                      시간 집계: {block.display.timeGrain ?? 'auto'}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p>
              원본 데이터와 SQL은 이 패널에 표시하지 않습니다. 표시 제한·추세 지원 여부는 각 블록의 결과 안내를 따릅니다.
              게시본은 별도 버전입니다.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
