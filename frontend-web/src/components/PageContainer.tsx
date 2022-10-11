import React from 'react';
import { Stack } from '@mui/material';

function PageContainer(props) {
  return <Stack sx={{ py: 4, px: '4%', flex: '1 1 auto', height: '100%' }}>{props.children}</Stack>;
}

export default PageContainer;
