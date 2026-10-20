import React from 'react';
import AnalysisBasis, { analysisFilterBasis } from '@/components/analysis/AnalysisBasis';
import { studioDateRangeSummary } from '../Studio/studioDocument';
import { useMinWidth } from '@/components/PageViewBox';
import { Notice } from '@/components/ui/notice';
import { PublishedBlockView } from '../Studio/PublishedBlockView';
import { STUDIO_COLUMNS } from '../Studio/studioTypes';
import type { StudioReusePreviewV1 } from './studioReusePreviewContract';
import '../Studio/studio.css';
export default function StudioReusePreview({ preview }: { preview: StudioReusePreviewV1 }): React.ReactElement {
  const desktop = useMinWidth(1200),
    tablet = useMinWidth(600),
    bp = desktop ? 'lg' : tablet ? 'md' : 'xs';
  return (
    <section aria-label="복사본 미리보기" className="vm-studio studio-remix-preview min-w-0">
      <h2 className="mb-2 text-lg font-semibold [overflow-wrap:anywhere]">{preview.title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{preview.scope} · 저장 전 미리보기</p>
      <AnalysisBasis
        className="mb-4"
        status="복사본 미리보기 · 저장 전"
        data={
          preview.basis
            ? `${preview.basis.sourceName} · #${preview.basis.sourceId}`
            : '연결한 내 데이터 · 상세 기준 확인 필요'
        }
        period={
          preview.basis
            ? studioDateRangeSummary(preview.basis.dateRange) + (preview.basis.dateRange ? '' : ' · UTC')
            : '기간 상세 미제공 · 미리보기 범위 확인'
        }
        filters={preview.basis ? analysisFilterBasis(preview.basis.filters) : '필터 상세 미제공 · 미리보기 범위 확인'}
        metrics={preview.blocks.map(block => block.title).join(' · ')}
        details={[{ label: '미리보기 범위', value: preview.scope }]}
        note="대상 데이터에서 다시 계산한 공통 기준입니다. Pivot의 추가 집계 조건은 해당 블록에 적용됩니다. 저장하면 새 비공개 사본을 만듭니다."
      />
      <Notice severity="info" className="mb-4">
        저장하면 새 지표 {preview.newMetricCount}개와 비공개 복사본을 만듭니다. 새 지표가 추가되면 대상 소스의 기존 저장
        보기는 갱신이 필요할 수 있습니다.
      </Notice>
      <div
        className="studio-published-grid"
        style={{ gridTemplateColumns: `repeat(${STUDIO_COLUMNS[bp]}, minmax(0, 1fr))` }}
      >
        {preview.blocks.map(b => {
          const r = preview.layouts[bp].find(r => r.id === b.blockId);
          const block =
            b.kind === 'SEGMENT_PIVOT'
              ? { ...b, id: b.blockId }
              : { ...b.widget, id: b.blockId, kind: b.kind, title: b.title, description: b.description, display: b.display };
          return (
            <article
              key={b.blockId}
              aria-label={b.title + ' 복사본 블록'}
              className="studio-published-card"
              style={{ gridColumn: `${r.x + 1} / span ${r.w}`, gridRow: `${r.y + 1} / span ${r.h}` }}
            >
              <PublishedBlockView block={block as any} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
