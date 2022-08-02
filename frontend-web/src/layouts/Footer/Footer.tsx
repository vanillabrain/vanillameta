import React from 'react';
import { Box, Container, Divider, Typography } from '@mui/material';
import ResponsiveContainer from '../../components/ResponsiveContainer';

function Footer() {
  return (
    <Box mt={4} px={3} pb={8}>
      {/*<ResponsiveContainer>*/}
      <Divider sx={{ marginBottom: 3 }} />
      <Typography sx={{ textAlign: 'center', color: '#9e9e9e', fontSize: 13, letterSpacing: 2 }}>
        Vanilla Meta 2022
      </Typography>
      {/*</ResponsiveContainer>*/}
    </Box>
  );
}

export default Footer;
