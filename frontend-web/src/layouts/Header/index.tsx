import React from 'react';
import { AppBar, Box, Divider, Hidden, Toolbar } from '@mui/material';
import { AddMenuIconButton } from '@/components/button/AddIconButton';
import Logo from './Logo';
import NavBar from './NavBar';
import { useNavigate } from 'react-router-dom';
import ProfileViewButton from '@/components/user/ProfileViewButton';
import Logout from '@/components/user/Logout';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const getMenuList = (t: any) => [
  { name: t('navigation.database'), link: '/data/source/create' },
  { name: t('navigation.dataset'), link: '/data/set/create' },
  { name: t('navigation.widget'), link: '/widget/create' },
  { name: t('navigation.dashboard'), link: '/dashboard/create?createType=dashboard' },
];

function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navItems = [
    { id: 1, name: t('navigation.dashboard'), link: 'dashboard' },
    { id: 2, name: t('navigation.widget'), link: 'widget' },
    { id: 3, name: t('navigation.data'), link: 'data' },
  ];

  const menuList = getMenuList(t);

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
          <Box sx={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <AddMenuIconButton menuList={menuList} handleSelect={handleMenuSelect} />
            <LanguageSwitcher />
            <ProfileViewButton />
          </Box>
        </Hidden>
        <Hidden smUp>
          <NavBar navItems={navItems.slice(0, 2)} />
          <Logout sx={{ fontSize: '12px', color: '#767676' }} />
        </Hidden>
      </Toolbar>
      <Divider />
    </AppBar>
  );
}

export default Header;
