import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AddMenuIconButton } from '@/components/button/AddIconButton';
import ProfileViewButton from '@/components/user/ProfileViewButton';
import Logout from '@/components/user/Logout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import Logo from './Logo';
import NavBar from './NavBar';

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
    { id: 1, name: t('nav.artifacts'), link: 'dashboard' },
    { id: 2, name: t('nav.widget'), link: 'widget' },
    { id: 3, name: t('nav.data'), link: 'data' },
  ];

  const handleMenuSelect = item => {
    if (item.link) {
      navigate(item.link);
    }
  };

  const language = i18n.language?.startsWith('en') ? 'en' : 'ko';

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 bg-background max-sm:h-[108px]">
      <nav className="flex h-full items-center justify-between relative flex-wrap gap-x-4 px-4 max-sm:pb-12 sm:flex-nowrap sm:gap-x-8 sm:px-6">
        <Logo className="shrink-0" />
        <div className="hidden sm:contents">
          <NavBar navItems={navItems} />
          <div className="flex items-center gap-4">
            <Select value={language} onValueChange={value => i18n.changeLanguage(value)}>
              <SelectTrigger
                size="sm"
                aria-label={t('common.language')}
                className="w-fit border-0 bg-transparent px-2 text-sm text-muted-foreground shadow-none focus-visible:ring-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <AddMenuIconButton menuList={menuList} handleSelect={handleMenuSelect} className="shrink-0" />
            <ProfileViewButton />
          </div>
        </div>
        <div className="contents sm:hidden">
          <NavBar navItems={navItems} />
          <Logout className="ml-auto text-xs text-muted-foreground" />
        </div>
      </nav>
      <Separator className="absolute inset-x-0 bottom-0" />
    </header>
  );
}

export default Header;
