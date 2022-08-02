import React from 'react';
import { Button, Stack, ListItem } from '@mui/material';
import { NavLink as RouterLink } from 'react-router-dom';

function NavBar(props) {
  return (
    <Stack
      component="ul"
      direction="row"
      spacing={2}
      sx={{ display: { xs: 'none', sm: 'flex', flexGrow: 1, paddingLeft: 0 } }}
    >
      {props.navItems.map(item => (
        <ListItem
          key={item.id}
          sx={{ width: 'auto', minWidth: 80, justifyContent: 'center', padding: 0, '& .active': { fontWeight: 800 } }}
        >
          <Button component={RouterLink} to={item.url} size="large" sx={{ color: 'inherit' }}>
            {item.name}
          </Button>
        </ListItem>
      ))}
    </Stack>
  );
}

export default NavBar;
