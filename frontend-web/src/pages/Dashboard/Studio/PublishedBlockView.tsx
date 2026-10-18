import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SegmentPivot from '../../Explore/SegmentPivot';
import { studioPivotMetricText } from './studioPivot';
import StudioReport from './StudioReport';
import { Button } from '@/components/ui/button';
import { formatMetric, localizedMetricSuffix } from '@/utils/formatMetric';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import LineChart from '@/widget/modules/linechart/LineChart';
import { analysisOptions } from '../analysisOptions';
import MetricTrend from '../Components/MetricTrend';
import type { PublishedBlock } from './studioPublication';
/** Deliberately pass only renderer data/options. No source lookup, SQL, links or executable content. */
export function PublishedBlockView({ block }: { block: PublishedBlock }) {
  const { i18n } = useTranslation();
  const display = {
    ...block.display,
    suffix: localizedMetricSuffix(block.display?.suffix, i18n?.resolvedLanguage || i18n?.language),
  };
  const [showRows, setShowRows] = useState(false);
  const format = (value: unknown) => (value === null || value === undefined ? '—' : formatMetric(value, display).text);
  const fields = [block.categoryField, block.valueField].filter((value): value is string => typeof value === 'string');
  return (
    <>
      <h2>{block.title}</h2>
      {block.description && (
        <p className="studio-published-description">
          {(block.display?.presentation === 'summary' || block.display?.presentation === 'table') &&
            '작성 설명 · 수치 검증 대상 아님: '}
          {block.description}
        </p>
      )}
      {block.kind === 'SEGMENT_PIVOT' ? (
        <div className="studio-pivot-body">
          <SegmentPivot embedded result={block.pivot} metricText={studioPivotMetricText(formatMetric)} />
        </div>
      ) : block.display?.presentation === 'summary' || block.display?.presentation === 'table' ? (
        <StudioReport
          title={block.title}
          description=""
          kind={block.kind}
          presentation={block.display.presentation}
          display={display}
          rows={block.datas}
          valueField={block.valueField}
          categoryField={block.categoryField}
        />
      ) : block.kind === 'BOARD_NUMERIC' ? (
        <div className="studio-published-value" title={String(block.datas[0]?.[block.valueField] ?? '')}>
          {format(block.datas[0]?.[block.valueField])}
        </div>
      ) : (
        <div className="studio-published-chart">
          {block.kind === 'CHART_LINE' ? (
            <LineChart
              option={analysisOptions({
                type: block.kind,
                valueField: block.valueField,
                categoryField: block.categoryField,
                ...display,
              })}
              dataSet={block.datas}
              seriesOp={{ showSymbol: block.datas.length === 1, ...(block.datas.length === 1 ? { symbolSize: 7 } : {}) }}
              defaultOp={{ animation: false }}
              createOp={{ grid: { left: 52, right: 44, top: 12, bottom: 28, containLabel: false } }}
            />
          ) : (
            <WidgetViewer
              hideHeader
              widgetType={block.kind}
              widgetOption={analysisOptions({
                type: block.kind,
                valueField: block.valueField,
                categoryField: block.categoryField,
                ...display,
              })}
              dataSet={block.datas}
              isInvalidData={false}
              title=""
              description=""
            />
          )}
        </div>
      )}
      {block.kind === 'BOARD_NUMERIC' && block.display?.presentation !== 'summary' && block.trend && (
        <MetricTrend trend={{ ...block.trend, column: '' }} title={block.title} {...display} />
      )}
      {block.kind === 'BOARD_NUMERIC' && (
        <Button
          className="studio-published-data-toggle"
          variant="ghost"
          size="sm"
          aria-expanded={showRows}
          onClick={() => setShowRows(value => !value)}
        >
          {showRows ? '집계 데이터 닫기' : '집계 데이터 보기'}
        </Button>
      )}
      {showRows && (
        <div className="studio-published-table" tabIndex={0} role="region" aria-label={block.title + ' 집계 데이터'}>
          <table>
            <caption>{block.title} · 정확한 집계값</caption>
            <thead>
              <tr>
                {fields.map(field => (
                  <th key={field} scope="col">
                    {field}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.datas.map((row, index) => (
                <tr key={index}>
                  {fields.map(field => (
                    <td key={field}>{row[field] === null ? '—' : String(row[field] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
