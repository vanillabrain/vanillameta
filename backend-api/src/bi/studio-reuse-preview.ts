import { ConflictException } from '@nestjs/common';
import { executePreparedSegment } from './bi-segment-engine';
import { metricExpression } from './metric-expression';
import { studioDigest } from '../dashboard-studio/studio-legacy';
import { studioPivotResult } from '../dashboard-studio/studio-pivot.service';
import {
  StudioReusePlan,
  StudioReusePreviewBlock,
  StudioReusePreviewV1,
  StudioReuseReadContext,
} from './studio-reuse-plan';
/** Read-only candidate execution. Authority and immutable file pinning belong to the caller. */
export async function previewStudioReuse(
  plan: StudioReusePlan,
  context: StudioReuseReadContext,
): Promise<StudioReusePreviewV1> {
  const { digest, ...value } = plan;
  if (studioDigest(value) !== digest)
    throw new ConflictException('복제 계획이 변경되었습니다. 다시 미리보기하세요.');
  await context.assertCurrent();
  const charts = await context.previewCharts(plan.draft);
  if (charts.widgets.length !== plan.blocks.filter(b => b.chart).length)
    throw new ConflictException('차트 결과가 누락되었습니다.');
  const blocks: StudioReusePreviewBlock[] = [];
  let chartIndex = 0;
  for (const b of plan.blocks) {
    const base = {
      blockId: b.original.id,
      title: b.original.title,
      description: b.original.description,
      display: b.original.display,
    };
    if (b.pivot) {
      const input = {
        ...b.pivot,
        measures: b.pivot.measures.map(m => ({
          ...m,
          expression: metricExpression(
            plan.graph.nodes.find(n => n.key === m.id).definition,
            plan.target,
          ),
        })),
      };
      const result = await executePreparedSegment(input, {
        profile: plan.target,
        sourceRevision: plan.target.dataVersion,
        viewRevision: plan.digest,
        query: context.query,
        assertCurrent: context.assertCurrent,
      });
      blocks.push({ ...base, kind: 'SEGMENT_PIVOT', pivot: studioPivotResult(result, true) });
    } else {
      const widget = charts.widgets[chartIndex++];
      const shown = Object.fromEntries(
        [
          'type',
          'title',
          'description',
          'valueField',
          'categoryField',
          'decimalPlaces',
          'numberNotation',
          'prefix',
          'suffix',
          'fields',
          'datas',
          'trend',
          'trendUnavailable',
        ]
          .filter(k => widget[k] !== undefined)
          .map(k => [k, widget[k]]),
      );
      if (shown.trend) {
        const t = shown.trend;
        shown.trend = {
          grain: t.grain,
          ...(t.timeZone ? { timeZone: t.timeZone } : {}),
          points: t.points,
        };
      }
      blocks.push({
        ...base,
        kind: b.original.kind as Exclude<typeof b.original.kind, 'SEGMENT_PIVOT'>,
        widget: shown,
      });
    }
  }
  await context.assertCurrent();
  return {
    schemaVersion: 1,
    kind: 'studio-reuse-preview',
    title: plan.title,
    capturedAt: new Date().toISOString(),
    scope: '연결한 파일 · 저장된 기간과 필터 · UTC',
    basis: {
      sourceId: plan.target.sourceId,
      sourceName: plan.target.name,
      filters: JSON.parse(JSON.stringify(plan.filters)),
      ...(plan.dateRange ? { dateRange: JSON.parse(JSON.stringify(plan.dateRange)) } : {}),
    },
    blocks,
    layouts: plan.layouts,
    newMetricCount: plan.graph.nodes.length,
  };
}
