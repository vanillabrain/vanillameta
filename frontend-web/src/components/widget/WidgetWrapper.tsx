import React from 'react';
import { Divider, Box, Stack, Typography } from '@mui/material';

function WidgetWrapper(props) {
  const { title, width, button } = props;

  return (
    <Box
      sx={{
        width: width,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', py: 1 }}>
        <Typography variant="subtitle1" component="span" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {button}
      </Stack>
      <Divider sx={{ marginBottom: 4 }} />
      {props.children}
    </Box>
  );
}

WidgetWrapper.defaultProps = {
  title: '',
  width: '100%',
  menuList: false,
  naviUrl: false,
  button: false,
};

export default WidgetWrapper;
