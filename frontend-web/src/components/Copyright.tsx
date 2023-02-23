import { Link, Typography } from '@mui/material';
import React from 'react';

const Copyright = (props: any) => {
  return (
    <Typography color="text.secondary" align="center" {...props}>
      <Link
        color="inherit"
        href="https://vanillabrain.com/"
        sx={{ fontSize: '13px', color: '#767676', fontWeight: 'bold', textDecoration: 'none' }}
      >
        ⓒ VanillaBrain Inc.
      </Link>
    </Typography>
  );
};

export default Copyright;
