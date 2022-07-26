import React from 'react';
import { Box, Link } from '@mui/material';

const logo = '../../assets/images/logo.png';

function Logo(props) {
  return (
    <Box component="h1" sx={{ width: 'auto', height: 50, display: { xs: 'none', sm: 'block' } }}>
      <Link href="/">
        <Box
          component="img"
          src={logo}
          sx={{ width: '100%', height: '100%', objectFit: 'scale-down' }}
          alt="Vanilla Meta 로고"
        />
      </Link>
    </Box>
  );
}

export default Logo;
