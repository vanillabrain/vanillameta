import React, { useEffect, useState } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import { WIDGET_TYPE } from '@/constant';
import LineChart from '@/modules/linechart/LineChart';
import { get } from '@/helpers/apiHelper';
import LineChartSetting from '@/widget/settings/LineChartSetting';
import PieChart from '@/modules/piechart/PieChart';
import PieChartSetting from '@/widget/settings/PieChartSetting';

const WidgetWrapper = props => {
  const { widgetOption, dataSetId } = props;

  const [widget, setWidget] = useState(null);
  useEffect(() => {
    console.log('WidgetWrapper');

    if (dataSetId) {
      getData();
    }
  }, []);

  const getData = () => {
    get('/data/sample/chart.json').then(response => {
      console.log('res', response.data);
      if (widgetOption) {
        console.log('widget widgetOption : ', widgetOption);
        const widgetType = widgetOption.type;
        let module = null;
        switch (widgetType) {
          case WIDGET_TYPE.CHART_LINE:
            module = <LineChart option={widgetOption.option} dataSet={response.data} />;
            break;
          case WIDGET_TYPE.CHART_BAR:
            break;
          case WIDGET_TYPE.CHART_PIE:
            module = <PieChart option={widgetOption.option} dataSet={response.data} />;
            break;

          default:
        }
        setWidget(module);
      }
    });
  };

  return (
    <Stack
      sx={{
        width: '100%',
        height: '100%',
        border: '1px solid #DADDDD',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', py: 1 }}>
        <Typography variant="subtitle1" component="span" sx={{ fontWeight: 500 }}>
          {widgetOption && widgetOption.title}
        </Typography>
      </Stack>
      <Divider sx={{ marginBottom: 4 }} />
      <Box
        sx={{
          width: '100%',
          height: '100%',
        }}
      >
        {widget}
      </Box>
    </Stack>
  );
};

export default WidgetWrapper;
