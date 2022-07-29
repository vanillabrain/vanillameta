import React, { useState } from 'react';
import { Button, Stack, Typography } from '@mui/material';

function NavBar(props) {
  return (
    <Stack direction="row" spacing={2} sx={{ display: { xs: 'none', sm: 'flex', flexGrow: 1 } }}>
      {props.navItems.map(item => (
        <Button href={item.url} size="large" key={item.id} sx={{ color: 'inherit' }}>
          {item.name}
        </Button>
      ))}
    </Stack>
  );
}

export default NavBar;
