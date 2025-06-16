import React from 'react';
import PieChart from '@/widget/modules/piechart/PieChart';

interface DonutChartProps {
  option: any;
  dataSet: any;
  seriesOp?: any;
}

function DonutChart(props: DonutChartProps) {
  const { option, dataSet, seriesOp } = props;

  return (
    <PieChart
      option={option}
      dataSet={dataSet}
      seriesOp={{
        ...seriesOp,
        radius: option.series.radius,
      }}
    />
  );
}

export default DonutChart;
