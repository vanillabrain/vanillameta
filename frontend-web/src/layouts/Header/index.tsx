import React from 'react';
import { AppBar, Box, Divider, Hidden, Toolbar } from '@mui/material';
import { AddMenuIconButton } from '@/components/button/AddIconButton';
import Logo from './Logo';
import NavBar from './NavBar';
import { useNavigate } from 'react-router-dom';
import ProfileViewButton from '@/components/user/ProfileViewButton';
import Logout from '@/components/user/Logout';

const menuList = [
  { name: '데이터 소스', link: '/data/source/create' },
  { name: '데이터 셋', link: '/data/set/create' },
  { name: '위젯', link: '/widget/create' },
  { name: '대시보드', link: '/dashboard/create?createType=dashboard' },
];

function Header() {
  const navigate = useNavigate();

  const navItems = [
    { id: 1, name: '대시보드', link: 'dashboard' },
    { id: 2, name: '위젯', link: 'widget' },
    { id: 3, name: '데이터', link: 'data' },
  ];

  const handleMenuSelect = item => {
    if (item.link) {
      navigate(item.link);
    }
  };

  return (
    <AppBar elevation={0} component="nav" sx={{ left: 0, height: { xs: '56px', sm: '65px' } }}>
      <Toolbar variant="dense" sx={{ height: 65, justifyContent: 'space-between', columnGap: { xs: '20px', sm: '32px' } }}>
        <Logo />
        <Hidden smDown>
          <NavBar navItems={navItems} />
          <Box sx={{ display: 'flex', gap: '16px' }}>
            <AddMenuIconButton menuList={menuList} handleSelect={handleMenuSelect} />
            <ProfileViewButton />
          </Box>
        </Hidden>
        <Hidden smUp>
          <NavBar navItems={navItems.splice(0, 2)} />
          <Logout sx={{ fontSize: '12px', color: '#767676' }} />
        </Hidden>
      </Toolbar>
      <Divider />
    </AppBar>
  );
}

export default Header;
