import React from 'react';
import LineChartSetting from '@/widget/settings/LineChartSetting';

function MixedLineBarChartSetting({ ...ChartSettingProps }) {
  const chartTypeList = { value: ['line', 'bar'], label: ['선형', '막대형'] };

  return (
    <LineChartSetting
      {...ChartSettingProps}
      seriesItem={{
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
