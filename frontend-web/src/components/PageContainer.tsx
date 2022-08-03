import React from 'react';
import { Stack } from '@mui/material';

function PageContainer(props) {
  return <Stack sx={{ p: { xs: 3, sm: 4 }, px: 8 }}>{props.children}</Stack>;
}

export default PageContainer;
