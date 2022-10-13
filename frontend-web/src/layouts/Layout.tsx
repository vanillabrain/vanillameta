import React from 'react';
import { Box, Stack } from '@mui/material';

import Header from './Header/Header';
import Footer from './Footer/Footer';

function Layout(props) {
  const headerHeight = 60;

  return (
    <Stack
      sx={{
        width: '100%',
        height: '100%',
      }}
    >
      <Header height={headerHeight} />
      <Stack sx={{ marginTop: headerHeight + 'px', flex: '1 1 auto', height: '100%' }}>{props.children}</Stack>
      <Footer />
    </Stack>
  );
}

export default Layout;
