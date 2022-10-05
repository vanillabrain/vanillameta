import React from 'react';
import { Box, Paper } from '@mui/material';

const WidgetBox = props => {
  const { children, sx } = props;

  return (
    <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, ...sx }}>
      <Paper elevation={0} sx={{ height: '100%', px: 3, py: 5 }}>
        {children}
      </Paper>
    </Box>
  );
};

export default WidgetBox;
