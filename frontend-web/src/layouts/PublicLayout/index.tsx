import React, { useContext } from 'react';
import { Box, Stack } from '@mui/material';
import Footer from '@/layouts/Footer';
import { Outlet } from 'react-router-dom';
import { LandingLogo } from '@/layouts/Header/Logo';
import { MAX_WIDTH } from '@/constant';
import { LayoutContext } from '@/contexts/LayoutContext';

const PublicLayout = props => {
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
      <Stack sx={{ width: '100%', maxWidth: MAX_WIDTH, mx: 'auto', backgroundColor: '#fff' }}>
        <Stack sx={{ height: 65, justifyContent: 'center', pl: '20px' }}>
          <LandingLogo />
        </Stack>
        {children || <Outlet />}
      </Stack>
      <Footer />
    </Box>
  );
};

export default PublicLayout;
