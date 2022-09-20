import React, { useEffect } from 'react';
import { Box } from '@mui/material';

const WidgetWrapper = props => {
  const { data } = props;
  useEffect(() => {
    if (data) {
      console.log('widgetId : ', data);
    }
  }, [data]);
  return <Box></Box>;
};

export default WidgetWrapper;
