import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';
import { AGGREGATION_LIST } from '@/constant';

export type CategoryValue = string | number | boolean | null;
export interface CategorySelectionProps {
  onCategorySelect?: (value: CategoryValue) => void;
  selectedCategoryValues?: CategoryValue[];
  categorySelectionDisabled?: boolean;
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
              query: { maxWidth: 480 },
              option: { xAxis: { splitNumber: 2 }, grid: { right: option?.legendPosition === 'right' ? 120 : 28 } },
            },
            {
              option: {
                xAxis: { splitNumber: defaultOp?.xAxis?.splitNumber ?? 5 },
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
      if (onCategorySelect) {
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
    [option, dataSet, axis, seriesOp, defaultOp, createOp, onCategorySelect, t],
  );
  const chartEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (!onCategorySelect || categorySelectionDisabled || params?.componentType !== 'series') return;
        const categories = componentOption[axis + 'Axis']?.data;
        const index = params.dataIndex;
        if (!Number.isInteger(index) || index < 0 || index >= (categories?.length ?? 0)) return;
        const value = categories[index];
        if (isCategoryValue(value)) onCategorySelect(value);
      },
    }),
    [componentOption, axis, onCategorySelect, categorySelectionDisabled],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <ReactECharts
        ref={chartRef}
        option={componentOption}
        style={{ flex: '1 1 auto', minHeight: showTable ? 80 : 160, height: showTable ? 'auto' : '100%', width: '100%' }}
        lazyUpdate={true}
        notMerge={true}
        onEvents={onCategorySelect ? chartEvents : undefined}
      />
      <Button
        size="small"
        onClick={() => setShowTable(value => !value)}
        aria-expanded={showTable}
        sx={{ alignSelf: 'flex-end', flexShrink: 0, fontSize: 12 }}
      >
        {showTable ? t('chart.hideDataTable') : t('chart.showDataTable')}
      </Button>
      {showTable && (
        <Box
          role="region"
          aria-label={t('chart.showDataTable')}
          tabIndex={0}
          sx={{ overflow: 'auto', maxHeight: 'min(180px, 40%)', flexShrink: 0 }}
        >
          <Table size="small" aria-label={t('chart.showDataTable')}>
            <TableHead>
              <TableRow>
                <TableCell>{option[axis + 'Field']}</TableCell>
                {componentOption.series?.map((series, index) => (
                  <TableCell key={index} align="right">
                    {series.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {componentOption[axis + 'Axis']?.data?.map((name, index) => (
                <TableRow key={onCategorySelect ? JSON.stringify([typeof name, name]) : index}>
                  <TableCell component="th" scope="row">
                    {onCategorySelect ? (
                      <Button
                        type="button"
                        size="small"
                        variant="text"
                        aria-label={`필터: ${name === null ? '값 없음 (NULL)' : String(name)}`}
                        aria-pressed={selectedCategoryValues.some(value => value === name)}
                        aria-disabled={categorySelectionDisabled || undefined}
                        disabled={!isCategoryValue(name)}
                        title={
                          typeof name === 'string' && name.length > 2000 ? '필터 값은 2,000자 이하만 지원합니다.' : undefined
                        }
                        sx={{
                          textTransform: 'none',
                          minWidth: 0,
                          maxWidth: { xs: 180, sm: 260 },
                          whiteSpace: 'normal',
                          overflowWrap: 'anywhere',
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          bgcolor: selectedCategoryValues.some(value => value === name) ? 'action.selected' : undefined,
                        }}
                        onClick={() => {
                          if (!categorySelectionDisabled && isCategoryValue(name)) onCategorySelect(name);
                        }}
                      >
                        {name === null ? '값 없음 (NULL)' : String(name)}
                      </Button>
                    ) : (
                      String(name)
                    )}
                  </TableCell>
                  {componentOption.series.map((series, seriesIndex) => (
                    <TableCell key={seriesIndex} align="right">
                      {typeof series.data[index] === 'number'
                        ? series.data[index].toLocaleString('en-US', { maximumFractionDigits: 6 })
                        : String(series.data[index] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
};

export default LineChart;
