import React from 'react';
import { Box } from '@mui/material';

const WidgetBox = props => {
  return <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }}>{props.children}</Box>;
};

export default WidgetBox;
