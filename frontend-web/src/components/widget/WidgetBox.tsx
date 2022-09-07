import React from 'react';
import { Box, Paper } from '@mui/material';

const WidgetBox = props => {
  return (
    <Box sx={{ width: '100%', height: '50vw', borderRadius: 1 }}>
      <Paper elevation={0} sx={{ height: '100%', px: 3, py: 5 }}>
        {props.children}
      </Paper>
    </Box>
  );
};

export default WidgetBox;
