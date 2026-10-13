import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { getAggregationDataForChart, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';
import { AGGREGATION_LIST } from '@/constant';

const LineChart = props => {
  const { t } = useTranslation();
  const { option, dataSet, axis = 'x', seriesOp, defaultOp, createOp } = props;
  const reverseAxis = axis === 'x' ? 'y' : 'x';

  const [componentOption, setComponentOption] = useState<any>({});
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
        formatter: value => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value),
        ...defaultOp?.[reverseAxis + 'Axis']?.axisLabel,
      },
    },
    tooltip: {
      trigger: 'axis',
      ...defaultOp?.tooltip,
      valueFormatter: value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 }),
    },
  };

  useEffect(() => {
    if (option && dataSet) {
      const newOption = createComponentOption();
      setComponentOption(newOption);
    }
  }, [option, dataSet]);

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
      aggrData = getAggregationDataForChart(dataSet, option[axis + 'Field'], item.field, item.aggregation);
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
          axisLabel: { interval: axis === 'y' ? 0 : 'auto', fontSize: 12 },
        },
        series: newSeries,
        grid: getGridSize(option.legendPosition),
        legend: getLegendOption(option.legendPosition),
        ...createOp,
      };
      newOption = { ...defaultComponentOption, ...op };
    }
    // console.log(newOption);
    return newOption;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <ReactECharts
        ref={chartRef}
        option={componentOption}
        style={{ flex: '1 1 auto', minHeight: 160, height: '100%', width: '100%' }}
        lazyUpdate={true}
        notMerge={true}
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
        <Box sx={{ overflow: 'auto', maxHeight: 180, flexShrink: 0 }}>
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
                <TableRow key={index}>
                  <TableCell component="th" scope="row">
                    {String(name)}
                  </TableCell>
                  {componentOption.series.map((series, seriesIndex) => (
                    <TableCell key={seriesIndex} align="right">
                      {typeof series.data[index] === 'number'
                        ? series.data[index].toLocaleString('en-US', { maximumFractionDigits: 6 })
                        : String(series.data[index] ?? '')}
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
