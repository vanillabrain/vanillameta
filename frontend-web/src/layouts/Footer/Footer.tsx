import React from 'react';
import { Box, Divider, Typography } from '@mui/material';

function Footer(props) {
  const footerHeight = props.height;

  return (
    <Box sx={{ height: footerHeight }}>
      <Typography
        sx={{
          width: '100%',
          height: '16px',
          margin: '40px 0 0 0',
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
    </Box>
  );
}

export default Footer;
