import React from 'react';
import { Box, Divider, Stack, useMediaQuery, useTheme } from '@mui/material';

const MobileViewBox = props => {
  const { title, sx } = props;

  return (
    <Box
      sx={{
        display: 'flex',
        flex: '1 1 auto',
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Box
        sx={{
          width: '100%',
          minWidth: '100%',
          height: '100%',
          flex: '1 1 auto',
          backgroundColor: '#f9f9fa',
          ...sx,
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ width: '100%', height: '57px', backgroundColor: '#ffffff' }}
        >
          {title}
        </Stack>
        <Divider sx={{ width: '100%', height: '1px' }} />
        {props.children}
      </Box>
    </Box>
  );
};

const DesktopViewBox = props => {
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
          width: '1392px',
          minWidth: '1392px',
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
          {button}
        </Stack>
        <Divider sx={{ width: '100%', height: '1px' }} />
        {props.children}
      </Box>
    </Box>
  );
};

function PageViewBox(props) {
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));

  return matches ? <DesktopViewBox {...props} /> : <MobileViewBox {...props} />;
}

export default PageViewBox;
