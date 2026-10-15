import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

function NavBar(props) {
  const { i18n } = useTranslation();
  const navItems = [
    ...props.navItems,
    { id: 'commerce', name: i18n.language?.startsWith('en') ? 'COMMERCE' : '매출·환불', link: '/commerce' },
  ];
  return (
    <ul className="m-0 flex grow list-none flex-row items-center p-0">
      {navItems.map(item => (
        <li key={item.id} className="w-auto">
          <NavLink
            to={item.link}
            className={({ isActive }) =>
              cn(
                'flex h-[50px] items-center justify-center px-[14px] text-[13px] leading-normal font-medium whitespace-nowrap sm:px-[18px] sm:text-[15px]',
                isActive ? 'font-bold text-primary' : 'text-muted-foreground',
              )
            }
          >
            {item.name}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export default NavBar;
