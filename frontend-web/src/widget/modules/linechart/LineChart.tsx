import { chartTheme } from '@/components/charts/chartTheme';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';
import { AGGREGATION_LIST } from '@/constant';
import type { DateRange } from '@/pages/Dashboard/Components/PersonalSavedViews';
import { TimeSelection, categoryTimeRange, sameTimeRange, timeRangeLabel } from '@/pages/Dashboard/Components/timeSelection';

export type CategoryValue = string | number | boolean | null;
export interface ContributionSelectionProps {
  onContributionSelect?: (category: CategoryValue) => void;
  contributionDisabled?: boolean;
}
export interface CategorySelectionProps extends ContributionSelectionProps {
  onCategorySelect?: (value: CategoryValue) => void;
  selectedCategoryValues?: CategoryValue[];
  categorySelectionDisabled?: boolean;
  onTimeSelect?: (range: DateRange) => void;
  timeSelection?: TimeSelection;
  timeSelectionDisabled?: boolean;
  selectedTimeRange?: DateRange | null;
}

const isCategoryValue = (value: unknown): value is CategoryValue =>
  value === null ||
  (typeof value === 'string' && value.length <= 2000) ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

const LineChart = (
  props: CategorySelectionProps & {
    option: any;
    dataSet: any[];
    axis?: string;
    seriesOp?: any;
    defaultOp?: any;
    createOp?: any;
    [key: string]: any;
  },
) => {
  const { t } = useTranslation();
  const {
    option,
    dataSet,
    axis = 'x',
    seriesOp,
    defaultOp,
    createOp,
    onCategorySelect,
    selectedCategoryValues = [],
    categorySelectionDisabled = false,
    onTimeSelect,
    timeSelection,
    timeSelectionDisabled = false,
    selectedTimeRange,
    onContributionSelect,
    contributionDisabled = false,
  } = props;
  const reverseAxis = axis === 'x' ? 'y' : 'x';

  const [showTable, setShowTable] = useState(false);
  const chartRef = useRef<ReactECharts>(null);
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!instance.isDisposed()) instance.resize();
      });
    });
    observer.observe(instance.getDom());
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const defaultComponentOption = {
    grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
    [axis + 'Axis']: {
      type: 'category',
    },
    series: [],
    emphasis: {
      focus: 'series',
      blurScope: 'coordinateSystem',
    },
    ...defaultOp,
    [reverseAxis + 'Axis']: {
      type: 'value',
      ...defaultOp?.[reverseAxis + 'Axis'],
      axisLabel: {
        hideOverlap: true,
        formatter: value => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value),
        ...defaultOp?.[reverseAxis + 'Axis']?.axisLabel,
      },
    },
    tooltip: {
      trigger: 'axis',
      ...defaultOp?.tooltip,
      valueFormatter: value => (value == null ? '—' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 })),
    },
    media:
      axis === 'y'
        ? [
            {
              query: { maxWidth: 260 },
              option: {
                xAxis: { splitNumber: 2 },
                yAxis: { axisLabel: { width: 48, overflow: 'truncate' } },
                grid: { right: option?.legendPosition === 'right' ? 120 : 12 },
              },
            },
            {
              query: { minWidth: 261, maxWidth: 480 },
              option: {
                xAxis: { splitNumber: 2 },
                yAxis: { axisLabel: { width: null, overflow: 'none' } },
                grid: { right: option?.legendPosition === 'right' ? 120 : 28 },
              },
            },
            {
              option: {
                xAxis: { splitNumber: defaultOp?.xAxis?.splitNumber ?? 5 },
                yAxis: { axisLabel: { width: null, overflow: 'none' } },
                grid: { right: getGridSize(option?.legendPosition).right },
              },
            },
          ]
        : [],
  };

  /**
   *
   * 위젯옵션과 데이터로
   * 컴포넌트에 맞는 형태로 생성
   */
  const createComponentOption = () => {
    // console.log('createComponentOption', option);
    let newOption = {};

    // series option에서 가져오기
    const newSeries = [];
    let aggrData = [];
    option.series.forEach(item => {
      const categoryField = option[axis + 'Field'];
      if (onCategorySelect || onTimeSelect || onContributionSelect) {
        // Group by the original typed key instead of the utility's string-coerced object key.
        const groups = new Map<unknown, any[]>();
        dataSet.forEach(row => {
          const category = row[categoryField];
          if (!groups.has(category)) groups.set(category, []);
          groups.get(category).push(row);
        });
        aggrData = Array.from(groups, ([category, rows]) => ({
          ...getAggregationDataForChart(rows, categoryField, item.field, item.aggregation)[0],
          [categoryField]: category,
        }));
      } else {
        aggrData = getAggregationDataForChart(dataSet, categoryField, item.field, item.aggregation);
      }
      // console.log('aggrData : ', aggrData);
      if (item.field) {
        const series = {
          name:
            (item?.fieldLabel ? item.fieldLabel : item.field) +
            (option?.legendAggregation
              ? ` (${AGGREGATION_LIST(t).find(element => element.value === item.aggregation).label})`
              : ''),
          data: aggrData.map(dataItem => dataItem[item.field]),
          type: item.type ? item.type : 'line',
          color: item.color,
          label: { show: option.label },
          markPoint: option.mark && {
            data: [
              { type: 'max', name: 'Max' },
              { type: 'min', name: 'Min' },
            ],
          },
          ...seriesOp,
        };
        newSeries.push(series);
      }
    });

    if (aggrData && option[axis + 'Field']) {
      const op = {
        [axis + 'Axis']: {
          type: 'category',
          data: option[axis + 'Field'] ? aggrData.map(item => item[option[axis + 'Field']]) : '',
          inverse: axis === 'y',
          axisLabel: {
            interval: axis === 'y' ? 0 : 'auto',
            fontSize: 12,
            hideOverlap: true,
            ...(option.categoryDateFormat === 'day'
              ? {
                  formatter: (value: string) =>
                    /^\d{4}-\d{2}-\d{2}T/.test(String(value)) ? String(value).slice(0, 10) : String(value),
                }
              : {}),
          },
        },
        series: newSeries,
        grid: {
          ...getGridSize(option.legendPosition),
          ...(axis === 'x' && option.legendPosition !== 'top' ? { top: 12 } : {}),
        },
        legend: getLegendOption(option.legendPosition),
        ...createOp,
      };
      newOption = { ...defaultComponentOption, ...op };
    }
    // console.log(newOption);
    return newOption;
  };

  const componentOption: any = useMemo(
    () => (option && dataSet ? createComponentOption() : {}),
    [option, dataSet, axis, seriesOp, defaultOp, createOp, onCategorySelect, onTimeSelect, onContributionSelect, t],
  );

  const canContribute = (category: unknown): category is CategoryValue =>
    isCategoryValue(category) &&
    typeof option[axis + 'Field'] === 'string' &&
    !!option[axis + 'Field'] &&
    dataSet.some(
      row =>
        row && Object.prototype.hasOwnProperty.call(row, option[axis + 'Field']) && row[option[axis + 'Field']] === category,
    );
  const contributionLabel = (category: CategoryValue) =>
    category === null
      ? '값 없음 (NULL)'
      : `${String(category)} (${
          typeof category === 'number' ? '숫자' : typeof category === 'boolean' ? '불리언' : '문자열'
        })`;
  const chartEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (params?.componentType !== 'series') return;
        const categories = componentOption[axis + 'Axis']?.data;
        const index = params.dataIndex;
        if (!Number.isInteger(index) || index < 0 || index >= (categories?.length ?? 0)) return;
        const value = categories[index];
        if (onTimeSelect) {
          const range = categoryTimeRange(dataSet, option[axis + 'Field'], value, timeSelection);
          if (!timeSelectionDisabled && range) onTimeSelect(range);
        } else if (onCategorySelect && !categorySelectionDisabled && isCategoryValue(value)) onCategorySelect(value);
      },
    }),
    [
      componentOption,
      axis,
      onCategorySelect,
      categorySelectionDisabled,
      onTimeSelect,
      timeSelectionDisabled,
      timeSelection,
      dataSet,
      option,
    ],
  );

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ReactECharts
        theme={chartTheme}
        ref={chartRef}
        option={componentOption}
        style={{ flex: '1 1 auto', minHeight: showTable ? 80 : 160, height: showTable ? 'auto' : '100%', width: '100%' }}
        lazyUpdate={true}
        notMerge={true}
        onEvents={onCategorySelect || onTimeSelect ? chartEvents : undefined}
      />
      {onTimeSelect && (
        <div className="px-2 text-xs text-muted-foreground">시점을 눌러 기간 필터링 · 키보드는 데이터 표에서 선택</div>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setShowTable(value => !value)}
        aria-expanded={showTable}
        className="shrink-0 self-end text-xs"
      >
        {showTable ? t('chart.hideDataTable') : t('chart.showDataTable')}
      </Button>
      {showTable && (
        <div
          role="region"
          aria-label={t('chart.showDataTable')}
          tabIndex={0}
          className="max-h-[min(180px,40%)] shrink-0 overflow-auto"
        >
          <Table aria-label={t('chart.showDataTable')}>
            <TableHeader>
              <TableRow>
                <TableHead>{option[axis + 'Field']}</TableHead>
                {componentOption.series?.map((series, index) => (
                  <TableHead key={index} className="text-right">
                    {series.name}
                  </TableHead>
                ))}
                {onContributionSelect && <TableHead>집계 원본 행</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {componentOption[axis + 'Axis']?.data?.map((name, index) => (
                <TableRow
                  key={
                    onCategorySelect || onTimeSelect || onContributionSelect ? JSON.stringify([typeof name, name]) : index
                  }
                >
                  <TableHead scope="row" className="font-normal">
                    {onTimeSelect ? (
                      (() => {
                        const range = categoryTimeRange(dataSet, option[axis + 'Field'], name, timeSelection);
                        return range ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`기간 선택: ${timeRangeLabel(range)}`}
                            aria-pressed={sameTimeRange(selectedTimeRange, range)}
                            aria-disabled={timeSelectionDisabled || undefined}
                            className="h-auto min-h-11 min-w-11 justify-start text-left whitespace-normal [overflow-wrap:anywhere]"
                            onClick={() => {
                              if (!timeSelectionDisabled) onTimeSelect(range);
                            }}
                          >
                            {String(name).replace('T', ' ').replace('Z', '')}
                          </Button>
                        ) : (
                          String(name)
                        );
                      })()
                    ) : onCategorySelect ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`필터: ${name === null ? '값 없음 (NULL)' : String(name)}`}
                        aria-pressed={selectedCategoryValues.some(value => value === name)}
                        aria-disabled={categorySelectionDisabled || undefined}
                        disabled={!isCategoryValue(name)}
                        title={
                          typeof name === 'string' && name.length > 2000 ? '필터 값은 2,000자 이하만 지원합니다.' : undefined
                        }
                        className={cn(
                          'h-auto max-w-[180px] min-w-0 justify-start text-left whitespace-normal [overflow-wrap:anywhere] sm:max-w-[260px]',
                          selectedCategoryValues.some(value => value === name) && 'bg-muted text-foreground',
                        )}
                        onClick={() => {
                          if (!categorySelectionDisabled && isCategoryValue(name)) onCategorySelect(name);
                        }}
                      >
                        {name === null ? '값 없음 (NULL)' : String(name)}
                      </Button>
                    ) : (
                      String(name)
                    )}
                  </TableHead>
                  {componentOption.series.map((series, seriesIndex) => (
                    <TableCell key={seriesIndex} className="text-right">
                      {typeof series.data[index] === 'number'
                        ? series.data[index].toLocaleString('en-US', { maximumFractionDigits: 6 })
                        : String(series.data[index] ?? '—')}
                    </TableCell>
                  ))}
                  {onContributionSelect && (
                    <TableCell>
                      {canContribute(name) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`이 항목의 집계 원본 행 보기: ${contributionLabel(name)}`}
                          aria-disabled={contributionDisabled || undefined}
                          className="h-auto min-h-11 min-w-11 whitespace-normal"
                          onClick={() => {
                            if (!contributionDisabled && canContribute(name)) onContributionSelect(name);
                          }}
                        >
                          이 항목의 집계 원본 행 보기
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default LineChart;
