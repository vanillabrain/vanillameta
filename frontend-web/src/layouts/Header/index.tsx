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
import { useAuthContext } from '@/contexts/AuthContext';

const getMenuList = (t: any) => [
  { name: t('navigation.database'), link: '/data/source/create' },
  { name: t('navigation.dataset'), link: '/data/set/create' },
  { name: t('navigation.widget'), link: '/widget/create' },
  { name: t('navigation.dashboard'), link: '/dashboard/create?createType=dashboard' },
];

function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthContext();

  // 기본 네비게이션 항목
  const baseNavItems = [
    { id: 1, name: t('navigation.dashboard'), link: 'dashboard' },
    { id: 2, name: t('navigation.widget'), link: 'widget' },
    { id: 3, name: t('navigation.data'), link: 'data' },
  ];

  // 관리자 권한 체크 (임시로 모든 인증된 사용자에게 허용)
  const hasAdminPermission = user && true; // 향후 실제 권한 체크 로직으로 교체

  // 관리자 권한이 있으면 Admin 링크 추가
  const navItems = hasAdminPermission 
    ? [...baseNavItems, { id: 4, name: '🔧 관리자', link: 'admin' }]
    : baseNavItems;

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
