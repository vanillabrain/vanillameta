import React, { useMemo, memo } from 'react';
import OptimizedChart from '@/components/OptimizedChart';
import { getAggregationDataForChart, getCenter, getGridSize, getLegendOption } from '@/widget/modules/utils/chartUtil';

interface PieChartProps {
  option: any;
  dataSet: any;
  seriesOp?: any;
}

const PieChart = memo((props: PieChartProps) => {
  const { option, dataSet, seriesOp } = props;

  // 기본 옵션을 useMemo로 메모이제이션
  const defaultComponentOption = useMemo(
    () => ({
      grid: { top: '3%', right: '3%', bottom: '3%', left: '3%' },
      tooltip: {
        trigger: 'item' as const,
      },
      series: [],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    }),
    [],
  );

  /**
   * 위젯옵션과 데이터로 컴포넌트에 맞는 형태로 생성
   * useMemo를 사용하여 불필요한 재계산 방지
   */
  const componentOption = useMemo(() => {
    if (!option || !dataSet || !option.series?.name) {
      return defaultComponentOption;
    }

    const aggrData = getAggregationDataForChart(dataSet, option.series.name, option.series.field, option.series.aggregation);

    const series = {
      name: option.series.name,
      data: aggrData.map(item => ({
        value: item[option.series.field],
        name: item[option.series.name],
      })),
      type: 'pie',
      color: [...(option.series.color || [])],
      label: {
        show: !!option.series.label,
        formatter: option.series.label,
        bleedMargin: 70,
      },
      center: getCenter(option.legendPosition),
      ...seriesOp,
    };

    const op = {
      series: [series],
      grid: getGridSize(option.legendPosition),
      legend: option.legendPosition && {
        ...getLegendOption(option.legendPosition),
        type: 'scroll',
      },
    };

    return { ...defaultComponentOption, ...op };
  }, [option, dataSet, seriesOp, defaultComponentOption]);

  return (
    <OptimizedChart
      option={componentOption}
      style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%' }}
      lazyUpdate={true}
      notMerge={true}
      enableDataSampling={true}
      maxDataPoints={1000}
      renderer="canvas"
    />
  );
});

// 컴포넌트 이름 설정 (개발 도구에서 확인용)
PieChart.displayName = 'PieChart';

export default PieChart;
