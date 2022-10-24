import React from 'react';
import { Box, Link } from '@mui/material';

const logo = '../../static/images/logo/vanilla-meta-logo.png';

function Logo(props) {
  const { sx = { width: 105, height: 20 } } = props;
  return (
    <Box sx={sx}>
      <Link href="/">
        <Box component="img" src={logo} sx={{ width: '100%', height: '100%' }} alt="Vanilla Meta 로고" />
      </Link>
    </Box>
  );
}

export default Logo;
