import React from 'react';
import { useTranslation } from 'react-i18next';
import LineChartSetting from '@/widget/settings/LineChartSetting';

function MixedLineBarChartSetting({ ...ChartSettingProps }) {
  const { t } = useTranslation();
  const chartTypeList = [
    { value: 'line', label: t('settings.lineType') },
    { value: 'bar', label: t('settings.barType') },
  ];

  return (
    <LineChartSetting
      {...ChartSettingProps}
      seriesItem={{
        required: true,
        id: 'type',
        name: 'type',
        label: t('settings.kind'),
        optionList: chartTypeList,
        value: 'type',
      }}
    />
  );
}

export default MixedLineBarChartSetting;
