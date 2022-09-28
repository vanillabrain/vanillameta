import React from 'react';
import LineChartSetting from '@/widget/settings/LineChartSetting';

function MixedLineBarChartSetting({ ...ChartSettingProps }) {
  const chartTypeList = [
    { label: '선형', value: 'line' },
    { label: '막대형', value: 'bar' },
  ];

  return (
    <LineChartSetting
      {...ChartSettingProps}
      seriesItem={{
        id: 'type',
        name: 'type',
        label: '종류',
        optionList: chartTypeList,
        value: 'type',
        disabledDefaultValue: true,
      }}
    />
  );
}

export default MixedLineBarChartSetting;
