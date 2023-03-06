import React from 'react';
import { Box, Divider, Hidden, Stack } from '@mui/material';

function DashboardTitleBox(props) {
  const { title, button, sx } = props;

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Box
        sx={{
          // width: '1392px',
          // minWidth: '1392px',
          width: '100%',
          minWidth: '100%',
          height: '100%',
          borderRadius: '6px',
          border: 'solid 1px #ddd',
          backgroundColor: '#f9f9fa',
          ...sx,
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ width: '100%', height: '57px', backgroundColor: '#ffffff', borderRadius: '6px 6px 0px 0px' }}
        >
          {title}
          <Hidden smDown>{button}</Hidden>
        </Stack>
        <Divider sx={{ width: '100%', height: '1px' }} />
        {props.children}
      </Box>
    </Box>
  );
}

DashboardTitleBox.defaultProps = {
  title: '',
  width: '100%',
  menuList: false,
  naviUrl: false,
  button: false,
};

export default DashboardTitleBox;
