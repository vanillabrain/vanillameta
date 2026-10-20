import React from 'react';
import './studioReport.css';
import { formatMetric, MetricFormatOptions } from '@/utils/formatMetric';

type Props = {
  title: string;
  description?: string;
  kind: string;
  presentation: 'table' | 'summary';
  display: MetricFormatOptions;
  rows: unknown[];
  valueField: string;
  categoryField?: string;
  period?: string;
  scope?: string;
  height?: number;
};

/** Presentation of the executed aggregate only. No generated prose, raw rows, SQL or HTML. */
export default function StudioReport({
  title,
  description,
  kind,
  presentation,
  display,
  rows,
  valueField,
  categoryField,
  period,
  scope,
  height,
}: Props) {
  const format = (value: unknown) => formatMetric(value, display);
  const cell = (row: unknown, key: string) =>
    row && typeof row === 'object' ? (row as Record<string, unknown>)[key] : undefined;
  const valid =
    presentation === 'summary'
      ? kind === 'BOARD_NUMERIC' && rows.length === 1
      : kind !== 'BOARD_NUMERIC' && typeof categoryField === 'string';
  if (!valid) return <p role="status">이 표현에 맞는 집계 결과를 확인할 수 없습니다.</p>;
  const scalar = (value: unknown) => (value === null || value === undefined ? '값 없음' : String(value));
  const result = format(cell(rows[0], valueField));
  // A short numeric block must show its aggregate before metadata; keep its saved geometry.
  if (presentation === 'summary' && height !== undefined && height < 160)
    return (
      <div
        className="studio-report studio-report-compact"
        style={{ maxHeight: height, overflow: 'auto' }}
        role="region"
        tabIndex={0}
        aria-label={title + ' 요약 내용'}
      >
        <div className="studio-report-summary" role="note" aria-label={title + ' 집계 요약'}>
          <p className="studio-report-value">
            <strong title={result.exactText}>{result.text}</strong>
          </p>
          <details>
            <summary>조회 기준 · 정확한 집계값</summary>
            {(period || scope) && (
              <p className="studio-report-scope">조회 기준 · {[period, scope].filter(Boolean).join(' · ')}</p>
            )}
            <p>{result.exactText}</p>
            <p className="studio-report-scope">서버 조회 결과의 요약입니다. 원인·전망을 추론하지 않습니다.</p>
            {description && (
              <div className="studio-report-comment">
                <span>작성 설명 · 수치 검증 대상 아님</span>
                <p>{description}</p>
              </div>
            )}
          </details>
        </div>
      </div>
    );
  return (
    <div
      className="studio-report"
      style={{ maxHeight: height, overflow: presentation === 'summary' ? 'auto' : undefined, minWidth: 0 }}
    >
      {(period || scope) && <p className="studio-report-scope">조회 기준 · {[period, scope].filter(Boolean).join(' · ')}</p>}
      {presentation === 'summary' ? (
        <div className="studio-report-summary" role="note" aria-label={title + ' 집계 요약'}>
          <p>
            현재 조회 조건에서 <strong>{title}</strong>의 집계 결과는 <strong title={result.exactText}>{result.text}</strong>
            입니다.
          </p>
          <details>
            <summary>정확한 집계값</summary>
            <p className="tabular-nums break-words">{result.exactText}</p>
          </details>
          <p className="studio-report-scope">서버 조회 결과의 요약입니다. 원인·전망을 추론하지 않습니다.</p>
        </div>
      ) : rows.length === 0 ? (
        <p role="status">선택한 조건에 해당하는 집계 행이 없습니다.</p>
      ) : (
        <div
          className="studio-report-table"
          style={{ maxHeight: height === undefined ? undefined : Math.max(80, height - (period || scope ? 40 : 0)) }}
          role="region"
          tabIndex={0}
          aria-label={title + ' 집계 표'}
        >
          <table>
            <caption>
              {title} · 조회된 집계 {rows.length}행
            </caption>
            <thead>
              <tr>
                <th scope="col">분류</th>
                <th scope="col">집계값</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const value = format(cell(row, valueField));
                return (
                  <tr key={index}>
                    <th scope="row">{scalar(cell(row, categoryField ?? ''))}</th>
                    <td title={value.exactText}>
                      <span>{value.text}</span>
                      <details>
                        <summary>원시값</summary>
                        <span>{value.exactText}</span>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {description && (
        <div className="studio-report-comment">
          <span>작성 설명 · 수치 검증 대상 아님</span>
          <p>{description}</p>
        </div>
      )}
    </div>
  );
}
