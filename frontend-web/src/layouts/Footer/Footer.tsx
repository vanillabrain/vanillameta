import React from 'react';
import { Link, Stack, Typography } from '@mui/material';

const Footer = props => {
  const { height } = props;

  return (
    <Stack sx={{ height: height, alignItems: 'center', justifyContent: 'center' }}>
      <Link
        color="inherit"
        href="https://vanillabrain.com/"
        sx={{ fontSize: '13px', color: '#767676', textDecoration: 'none' }}
      >
        <Typography
          sx={{
            width: '100%',
            height: '16px',
            fontFamily: 'Pretendard',
            fontSize: '13px',
            fontWeight: 'normal',
            fontStretch: 'normal',
            fontStyle: 'normal',
            lineHeight: 'normal',
            letterSpacing: 'normal',
            textAlign: 'center',
            color: '#767676',
          }}
        >
          ⓒ vanillaBrain 2022
        </Typography>
      </Link>
    </Stack>
  );
};

export default Footer;
