import React, { useEffect } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';

const WidgetWrapper = props => {
  const { data } = props;
  useEffect(() => {
    console.log('WidgetWrapper');
    if (data) {
      console.log('widget data : ', data);
    }
  }, []);
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        border: '1px solid #DADDDD',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', py: 1 }}>
        <Typography variant="subtitle1" component="span" sx={{ fontWeight: 500 }}>
          {data.title}
        </Typography>
      </Stack>
      <Divider sx={{ marginBottom: 4 }} />
      {props.children}
    </Box>
  );
};

export default WidgetWrapper;
