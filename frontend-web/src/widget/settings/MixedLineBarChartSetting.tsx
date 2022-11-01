import React from 'react';
import LineChartSetting from '@/widget/settings/LineChartSetting';

function MixedLineBarChartSetting({ ...ChartSettingProps }) {
  const chartTypeList = [
    { value: 'line', label: '선형' },
    { value: 'bar', label: '막대형' },
  ];

  return (
    <LineChartSetting
      {...ChartSettingProps}
      seriesItem={{
        required: true,
        id: 'type',
        name: 'type',
        label: '종류',
        optionList: chartTypeList,
        value: 'type',
      }}
    />
  );
}

export default MixedLineBarChartSetting;
