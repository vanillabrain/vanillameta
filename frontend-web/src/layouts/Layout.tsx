import React, { useContext } from 'react';
import { Box, Stack } from '@mui/material';

import Header from './Header/Header';
import Footer from './Footer/Footer';
import { LayoutContext } from '@/contexts/LayoutContext';

function Layout(props) {
  const headerHeight = 65;
  const footerHeight = 50;

  const { fixed } = useContext(LayoutContext);

  const defaultSx = {
    width: '100%',
    height: '100%',
  };

  const fixSx = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    flex: '1 1 auto',
  };

  return (
    <Box sx={fixed ? fixSx : defaultSx}>
      <Header height={headerHeight} />
      <Stack
        sx={{
          paddingTop: headerHeight + 'px',
          // height: '100%',
          minHeight: `calc(100% - ${footerHeight}px)`,
        }}
      >
        {props.children}
      </Stack>
      <Footer height={footerHeight} />
    </Box>
  );
}

export default Layout;
