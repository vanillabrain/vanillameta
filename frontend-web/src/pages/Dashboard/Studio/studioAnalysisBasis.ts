import type { AnalysisBasisValue } from '@/components/analysis/AnalysisBasis';
import { analysisFilterBasis } from '@/components/analysis/AnalysisBasis';
import { studioDateRangeSummary } from './studioDocument';
import type { StudioDocumentV1 } from './studioTypes';

/** Use the given document, including its pinned references; never mix in the current metric catalog. */
export function studioAnalysisBasis(document: StudioDocumentV1, sourceName?: string): AnalysisBasisValue {
  return {
    data: sourceName ? `${sourceName} · #${document.sourceId}` : `데이터 소스 #${document.sourceId}`,
    period: studioDateRangeSummary(document.dateRange) + (document.dateRange ? '' : ' · UTC'),
    filters: analysisFilterBasis(document.filters, !!document.conditions),
    metrics:
      document.blocks
        .map(
          block =>
            block.title +
            (block.measureRefs.length
              ? ' (' + block.measureRefs.map(ref => `지표 #${ref.id} · v${ref.definitionVersion}`).join(', ') + ')'
              : ' (블록에 고정된 계산)'),
        )
        .join(' · ') || '지표 없음',
  };
}
