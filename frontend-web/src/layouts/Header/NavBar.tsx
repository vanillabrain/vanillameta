import React from 'react';
import { Button, Stack, ListItem } from '@mui/material';
import { NavLink } from 'react-router-dom';

function NavBar(props) {
  return (
    <Stack component="ul" direction="row" sx={{ display: 'flex', flexGrow: 1, paddingLeft: 0, m: 0 }}>
      {props.navItems.map(item => (
        <ListItem
          key={item.id}
          sx={{
            width: 'auto',
            justifyContent: 'center',
            padding: 0,
            fontSize: 15,
            fontFamily: 'Pretendard',
            fontWeight: 500,
            fontStretch: 'normal',
            fontStyle: 'normal',
            lineHeight: 'normal',
            letterSpacing: 'normal',
            color: '#4a4a4a',
            '& .active': {
              color: '#0f5ab2',
              fontWeight: 'bold',
            },
          }}
        >
          <Button
            component={NavLink}
            to={item.link}
            sx={{
              minWidth: 0,
              color: 'inherit',
              padding: 0,
              fontSize: 15,
              height: 50,
              px: '18px',
              fontFamily: 'Pretendard',
              fontWeight: 500,
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 'normal',
              letterSpacing: 'normal',
            }}
          >
            {item.name}
          </Button>
        </ListItem>
      ))}
    </Stack>
  );
}

export default NavBar;
