import React from 'react';
import PieChart from '@/modules/piechart/PieChart';

function DonutChart(props) {
  const { option, dataSet, seriesOp, setDataLength } = props;

  return (
    <PieChart
      option={option}
      dataSet={dataSet}
      setDataLength={setDataLength}
      seriesOp={{
        ...seriesOp,
        radius: option.series.radius,
      }}
    />
  );
}

export default DonutChart;
