import React from 'react';
import { Box, Divider, Typography } from '@mui/material';

function Footer() {
  return (
    <Box>
      <Divider sx={{ marginBottom: 3 }} />
      <Typography sx={{ textAlign: 'center', color: '#9e9e9e', fontSize: 13, letterSpacing: 2, pb: 6 }}>
        Vanilla Meta 2022
      </Typography>
    </Box>
  );
}

export default Footer;
