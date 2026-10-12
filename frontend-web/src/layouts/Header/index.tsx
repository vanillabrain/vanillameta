import React from 'react';
import { AppBar, Box, Divider, MenuItem, Select, Toolbar } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AddMenuIconButton } from '@/components/button/AddIconButton';
import Logo from './Logo';
import NavBar from './NavBar';
import { useNavigate } from 'react-router-dom';
import ProfileViewButton from '@/components/user/ProfileViewButton';
import Logout from '@/components/user/Logout';

function Header() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const menuList = [
    { name: t('data.source'), link: '/data/source/create' },
    { name: t('data.dataset'), link: '/data/set/create' },
    { name: t('nav.widget'), link: '/widget/create' },
    { name: t('nav.dashboard'), link: '/dashboard/create?createType=dashboard' },
  ];

  const navItems = [
    { id: 1, name: t('nav.dashboard'), link: 'dashboard' },
    { id: 2, name: t('nav.widget'), link: 'widget' },
    { id: 3, name: t('nav.data'), link: 'data' },
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
        <Box sx={{ display: { xs: 'none', sm: 'contents' } }}>
          <NavBar navItems={navItems} />
          <Box sx={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Select
              size="small"
              variant="standard"
              disableUnderline
              inputProps={{ 'aria-label': t('common.language') }}
              value={i18n.language?.startsWith('en') ? 'en' : 'ko'}
              onChange={e => i18n.changeLanguage(e.target.value)}
              sx={{ fontSize: '12px', color: '#767676' }}
            >
              <MenuItem value="ko">한국어</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </Select>
            <AddMenuIconButton menuList={menuList} handleSelect={handleMenuSelect} />
            <ProfileViewButton />
          </Box>
        </Box>
        <Box sx={{ display: { xs: 'contents', sm: 'none' } }}>
          <NavBar navItems={navItems.slice(0, 2)} />
          <Logout sx={{ fontSize: '12px', color: '#767676' }} />
        </Box>
      </Toolbar>
      <Divider />
    </AppBar>
  );
}

export default Header;
