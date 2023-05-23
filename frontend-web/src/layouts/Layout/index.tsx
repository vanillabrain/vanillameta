import React, { useContext } from 'react';
import { Box, Stack } from '@mui/material';
import Header from '@/layouts/Header';
import Footer from '@/layouts/Footer';
import { LayoutContext } from '@/contexts/LayoutContext';
import { Outlet } from 'react-router-dom';

const Layout = props => {
  const { children } = props;
  const { fixed, footerBg } = useContext(LayoutContext);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        flex: '1 1 auto',
        overflow: fixed ? 'hidden' : 'visible',
        backgroundColor: footerBg ? footerBg : '#fff',
      }}
    >
      <Header />
      <Stack
        sx={{
          flex: '1 1 auto',
          width: '100%',
          pt: { xs: '56px', sm: '65px' },
          minHeight: `calc(100% - 50px)`,
        }}
      >
        {children || <Outlet />}
      </Stack>
      <Footer />
    </Box>
  );
};

export default Layout;
