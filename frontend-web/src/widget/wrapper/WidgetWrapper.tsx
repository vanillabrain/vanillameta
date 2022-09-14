import React, { useEffect } from 'react';
import { Box } from '@mui/material';

const WidgetWrapper = props => {
  const { widgetId } = props;
  useEffect(() => {
    if (widgetId) {
      console.log('widgetId : ', widgetId);
    }
  }, [widgetId]);
  return <Box></Box>;
};

export default WidgetWrapper;
