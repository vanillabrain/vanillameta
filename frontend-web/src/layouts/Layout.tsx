import React, { useContext } from 'react';
import { Box, Stack } from '@mui/material';

import Header from './Header/Header';
import Footer from './Footer/Footer';
import { LayoutContext } from '@/contexts/LayoutContext';
import { Outlet } from 'react-router-dom';

const Layout = props => {
  const { children } = props;
  const headerHeight = 65;
  const footerHeight = 50;

  const { fixed } = useContext(LayoutContext);

  const defaultSx = {
    width: '100%',
    height: '100%',
    flex: '1 1 auto',
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
          flex: '1 1 auto',
          width: '100%',
          minWidth: { sm: 'min-content' },
          pt: { xs: '56px', sm: '65px' },
          minHeight: `calc(100% - ${footerHeight}px)`,
        }}
      >
        {children || <Outlet />}
      </Stack>
      <Footer height={footerHeight} />
    </Box>
  );
};

export default Layout;
