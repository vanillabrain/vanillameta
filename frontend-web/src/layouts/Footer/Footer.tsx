import React from 'react';
import { Stack, Typography } from '@mui/material';

const Footer = props => {
  const { height } = props;

  return (
    <Stack sx={{ height: height, alignItems: 'center', justifyContent: 'center' }}>
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
        @ Vanilla Meta 2022
      </Typography>
    </Stack>
  );
};

export default Footer;
