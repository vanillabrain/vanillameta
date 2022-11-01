import React from 'react';
import { Box, Link } from '@mui/material';
import { ReactComponent as IconLogo } from '@/assets/images/logo.svg';

function Logo(props) {
  const { sx = { width: 105, height: 50 } } = props;
  return (
    <Box sx={sx}>
      <Link href="/">
        <IconLogo style={{ width: '100%', height: '100%' }} />
      </Link>
    </Box>
  );
}

export default Logo;
