import React from 'react';
import { Button, Stack, ListItem } from '@mui/material';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function NavBar(props) {
  const { i18n } = useTranslation();
  const navItems = [
    ...props.navItems,
    { id: 'commerce', name: i18n.language?.startsWith('en') ? 'COMMERCE' : '매출·환불', link: '/commerce' },
  ];
  return (
    <Stack component="ul" direction="row" sx={{ display: 'flex', flexGrow: 1, paddingLeft: 0, m: 0 }}>
      {navItems.map(item => (
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
              fontSize: { xs: 13, sm: 15 },
              height: 50,
              px: { xs: '14px', sm: '18px' },
              fontFamily: 'Pretendard',
              fontWeight: 500,
              fontStretch: 'normal',
              fontStyle: 'normal',
              lineHeight: 'normal',
              letterSpacing: 'normal',
              whiteSpace: 'nowrap',
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
