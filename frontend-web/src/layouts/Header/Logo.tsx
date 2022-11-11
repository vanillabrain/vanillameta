import React from 'react';
import { Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ReactComponent as IconLogo } from '@/assets/images/logo.svg';

function Logo(props) {
  const { sx = { width: 105, height: 50 } } = props;
  return (
    <Box sx={sx}>
      <RouterLink to="/">
        <IconLogo style={{ width: '100%', height: '100%' }} />
      </RouterLink>
    </Box>
  );
}

export default Logo;
