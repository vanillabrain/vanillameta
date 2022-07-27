import React from 'react';
import { Box, Container, Divider, Typography } from '@mui/material';

function Footer() {
  return (
    <Box p={3} pb={8} sx={{ backgroundColor: '#f3f4f6' }}>
      <Container sx={{ maxWidth: 1152, m: 'auto' }}>
        <Divider sx={{ marginBottom: 3 }} />
        <Typography sx={{ textAlign: 'center', color: '#9e9e9e', fontSize: 13, letterSpacing: 2 }}>
          Vanilla Meta 2022
        </Typography>
      </Container>
    </Box>
  );
}

export default Footer;