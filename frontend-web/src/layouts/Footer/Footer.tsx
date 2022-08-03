import React from 'react';
import { Divider, Typography } from '@mui/material';
import PageContainer from '../..//components/PageContainer';

function Footer() {
  return (
    <PageContainer>
      <Divider sx={{ marginBottom: 3 }} />
      <Typography sx={{ textAlign: 'center', color: '#9e9e9e', fontSize: 13, letterSpacing: 2, pb: 6 }}>
        Vanilla Meta 2022
      </Typography>
    </PageContainer>
  );
}

export default Footer;
