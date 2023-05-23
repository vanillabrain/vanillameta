import React from 'react';
import { AppBar, Box, Button, Divider, Hidden, Toolbar } from '@mui/material';
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

function Index(props) {
  const headerHeight = props.height;
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
      <Toolbar variant="dense" sx={{ height: headerHeight, justifyContent: 'space-between', columnGap: '32px' }}>
        <Logo />
        <Hidden smDown>
          <NavBar navItems={navItems} />
          <Box sx={{ display: 'flex', gap: '16px' }}>
            <AddMenuIconButton menuList={menuList} handleSelect={handleMenuSelect} />
            <ProfileViewButton />
          </Box>
        </Hidden>
        <Hidden smUp>
          <Logout sx={{ fontSize: '12px', color: '#767676' }} />
        </Hidden>
      </Toolbar>
      <Divider />
    </AppBar>
  );
}

export default Index;
