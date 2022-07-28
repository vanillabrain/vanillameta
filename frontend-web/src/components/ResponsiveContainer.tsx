import React from 'react';
import { Container } from '@mui/material';

function ResponsiveContainer(props) {
  const maxWidth = props.maxWidth ? props.maxWidth : 1024;

  return <Container sx={{ maxWidth: maxWidth, m: 'auto', px: 8 }}>{props.children}</Container>;
}

export default ResponsiveContainer;
