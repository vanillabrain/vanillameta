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
    <ul className="m-0 flex grow list-none flex-row items-center gap-1 p-0 max-sm:absolute max-sm:inset-x-4 max-sm:bottom-0 max-sm:h-12 max-sm:overflow-x-auto">
      {navItems.map(item => (
        <li key={item.id} className="w-auto">
          <NavLink
            to={item.link}
            className={({ isActive }) =>
              cn(
                'flex h-10 items-center justify-center rounded-md px-3 text-sm leading-5 font-medium whitespace-nowrap sm:px-4',
                isActive
                  ? 'bg-accent font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
