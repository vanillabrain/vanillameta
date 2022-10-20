import React from 'react';
import { Box, Stack } from '@mui/material';

import Header from './Header/Header';
import Footer from './Footer/Footer';

function Layout(props) {
  const headerHeight = 65;
  const footerHeight = 50;

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
      }}
    >
      <Header height={headerHeight} />
      <Stack
        sx={{
          marginTop: headerHeight + 'px',
        }}
      >
        {props.children}
      </Stack>
      <Footer />
    </Box>
  );
}

export default Layout;
