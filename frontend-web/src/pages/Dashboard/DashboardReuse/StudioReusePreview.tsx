import React from 'react';
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
