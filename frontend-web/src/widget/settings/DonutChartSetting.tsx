import React from 'react';
import { useTranslation } from 'react-i18next';
import PieChartSetting from '@/widget/settings/PieChartSetting';
import TextFieldForm from '@/components/form/TextFieldForm';
import { InputAdornment } from '@mui/material';

function DonutChartSetting(props) {
  const { t } = useTranslation();
  const { option, setOption, spec, dataSet } = props;

  const innerRadius = option.series.radius[0];
  const outerRadius = option.series.radius[1];

  const handleChange = event => {
    setOption(prevState => {
      const obj = { ...prevState };
      const radius = [...prevState.series.radius];
      const index = Number(event.target.name.slice(-1)) - 1;
      radius[index] = event.target.value + '%';
      obj.series.radius = radius;
      return obj;
    });
  };

  return (
    <PieChartSetting
      option={option}
      setOption={setOption}
      spec={spec}
      dataSet={dataSet}
      listItem={{
        title: t('settings.chartShape'),
        children: (
          <React.Fragment>
            <TextFieldForm
              id="radius1"
              name="radius1"
              label={t('settings.innerRadius')}
              type="number"
              value={innerRadius.slice(0, -1)}
              onChange={handleChange}
              endAdornment={<InputAdornment position="end">%</InputAdornment>}
            />
            <TextFieldForm
              id="radius2"
              name="radius2"
              label={t('settings.outerRadius')}
              type="number"
              value={outerRadius.slice(0, -1)}
              onChange={handleChange}
              endAdornment={<InputAdornment position="end">%</InputAdornment>}
            />
          </React.Fragment>
        ),
      }}
    />
  );
}

export default DonutChartSetting;
