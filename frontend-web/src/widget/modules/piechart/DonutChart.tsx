import React from 'react';
import PieChart from '@/widget/modules/piechart/PieChart';

function DonutChart(props) {
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
