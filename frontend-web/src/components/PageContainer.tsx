import React from 'react';
import { Stack } from '@mui/material';

function PageContainer(props) {
  return <Stack sx={{ width: '100%', height: '100%', flex: '1 1 auto' }}>{props.children}</Stack>;
}

export default PageContainer;
