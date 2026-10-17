import { useTranslation } from 'react-i18next';
import React, { useId } from 'react';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import { formatMetric, localizedMetricSuffix } from '@/utils/formatMetric';
import { analysisOptions } from '../analysisOptions';
import { CreationProposal } from './studioCreation';
export default function StudioSemanticReview({ proposal }: { proposal: CreationProposal }) {
  const headingId = useId();
  const { i18n } = useTranslation();
  return (
    <section className="studio-create-review" aria-labelledby={headingId}>
      <div className="studio-create-section-title">
        <div>
          <span className="studio-eyebrow">계산 미리보기</span>
          <h2 id={headingId}>{proposal.title}</h2>
        </div>
        <span>저장 전 · {proposal.semanticProposal.length}개 블록</span>
      </div>
      <p>지표와 차원을 확인하세요. 저장하면 같은 Studio에서 배치와 표현을 편집할 수 있습니다.</p>
      <div className="studio-create-preview-grid">
        {proposal.semanticProposal.map((item, index) => {
          const row = proposal.preview?.widgets[index];
          const metric = item.metric;
          const suffix = localizedMetricSuffix(row?.suffix, i18n?.resolvedLanguage || i18n?.language);
          const value = row?.datas[0]?.[row.valueField];
          return (
            <article className="studio-create-preview-card" key={index} aria-label={item.title + ' 생성 미리보기'}>
              <h3>{item.title}</h3>
              <p className="studio-create-definition">
                {metric.id ? '저장 지표 #' + metric.id + ' · v' + metric.definitionVersion : '새 지표'} ·{' '}
                {metric.aggregation ?? '저장된 계산'}
                {metric.column ? '(' + metric.column + ')' : ''}
              </p>
              {metric.denominatorColumn && (
                <p className="studio-create-definition">
                  분모: {metric.denominatorColumn} · 배율 {metric.scale ?? 1}
                </p>
              )}
              {item.dimension && (
                <p className="studio-create-definition">
                  차원: {item.dimension.column} · {item.dimension.type}
                </p>
              )}
              {!row ? (
                <p>계산 결과가 없습니다.</p>
              ) : row.type === 'BOARD_NUMERIC' ? (
                <div className="studio-create-number">
                  {value === null || value === undefined
                    ? '—'
                    : formatMetric(value, {
                        prefix: row.prefix,
                        suffix,
                        decimalPlaces: row.decimalPlaces ?? 0,
                        numberNotation: row.numberNotation === 'compact' ? 'compact' : 'full',
                      }).text}
                </div>
              ) : (
                <div className="studio-create-chart">
                  <WidgetViewer
                    hideHeader
                    widgetType={row.type}
                    widgetOption={analysisOptions({ ...row, suffix })}
                    dataSet={row.datas}
                    isInvalidData={false}
                    title=""
                    description=""
                  />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
