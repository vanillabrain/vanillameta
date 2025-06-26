import React from 'react';
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
  const navItems = hasAdminPermission ? [...baseNavItems, { id: 4, name: '🔧 관리자', link: 'admin' }] : baseNavItems;

  const menuList = getMenuList(t);

  const handleMenuSelect = item => {
    if (item.link) {
      navigate(item.link);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm h-14 sm:h-16">
      <div className="h-16 flex items-center justify-between px-4 gap-5 sm:gap-8">
        <Logo />
        <div className="hidden sm:flex items-center justify-between flex-1">
          <NavBar navItems={navItems} />
          <div className="flex gap-4 items-center">
            <AddMenuIconButton menuList={menuList} handleSelect={handleMenuSelect} />
            <LanguageSwitcher />
            <ProfileViewButton />
          </div>
        </div>
        <div className="flex sm:hidden items-center gap-4">
          <NavBar navItems={navItems.slice(0, 2)} />
          <Logout sx={{ fontSize: '12px', color: '#767676' }} />
        </div>
      </div>
      <div className="border-b border-gray-200" />
    </nav>
  );
}

export default Header;
