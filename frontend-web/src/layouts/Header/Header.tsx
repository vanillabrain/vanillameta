import React from 'react';
import { AppBar, Box, Divider, Toolbar } from '@mui/material';
import { AddMenuIconButton } from '@/components/button/AddIconButton';
import Logo from './Logo';
import NavBar from './NavBar';
import { useNavigate } from 'react-router-dom';

const menuList = [
  { name: '데이터 소스', link: '/data/source/create' },
  { name: '데이터 셋', link: '/data/set/create' },
  { name: '위젯', link: '/widget/create' },
  { name: '대시보드', link: '/dashboard/create?createType=dashboard' },
];

function Header(props) {
  const headerHeight = props.height;
  const navigate = useNavigate();

  const navItems = [
    { id: 1, name: '대시보드', link: 'dashboard' },
    { id: 2, name: '위젯', link: 'widget' },
    { id: 3, name: '데이터', link: 'data' },
  ];

  const handleMenuSelect = item => {
    if (item.link !== undefined) {
      navigate(item.link);
    }
  };

  return (
    <AppBar elevation={0} component="nav" sx={{ minWidth: '1440px', left: 0 }}>
      <Toolbar variant="dense" sx={{ height: headerHeight, justifyContent: 'space-between', columnGap: '40px' }}>
        <Logo sx={{ width: 105, height: 20 }} />
        <NavBar navItems={navItems} />
        <Box>
          <AddMenuIconButton menuList={menuList} handleSelect={handleMenuSelect} />
        </Box>
      </Toolbar>
      <Divider />
    </AppBar>
  );
}

export default Header;
