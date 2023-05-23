import React, { useContext } from 'react';
import { Link, Stack, Typography } from '@mui/material';
import { LayoutContext } from '@/contexts/LayoutContext';

export const Copyright = (props: any) => {
  return (
    <Typography color="text.secondary" align="center" {...props}>
      <Link
        color="inherit"
        href="https://vanillabrain.com/"
        target="_blank"
        sx={{ fontSize: '13px', color: '#767676', fontWeight: 'bold', textDecoration: 'none' }}
      >
        ⓒ VanillaBrain Inc.
      </Link>
    </Typography>
  );
};

const Footer = () => {
  const { footerBg } = useContext(LayoutContext);

  return (
    <Stack
      sx={{
        height: '50px',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: footerBg ? footerBg : '#fff',
      }}
    >
      <Copyright />
    </Stack>
  );
};

export default Footer;
