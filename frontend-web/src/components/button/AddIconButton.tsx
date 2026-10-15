import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import IconPlus from '@/assets/images/icon/btn-plus.svg';

const AddIconButton = ({ link = '', className = '', ...props }) => {
  return (
    <Button asChild className={cn('min-w-0 px-2', className)} {...props}>
      <RouterLink to={link}>
        <Plus className="size-7" aria-hidden="true" />
      </RouterLink>
    </Button>
  );
};

export default AddIconButton;

export const AddMenuButton = ({ menuList = [], label, className = '' }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" aria-label={label} className={cn('min-w-0', className)}>
          <Plus className="size-4 md:hidden" aria-hidden="true" />
          <span className="hidden md:inline">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {menuList.map(item => (
          <DropdownMenuItem key={item.name} asChild>
            <RouterLink to={item.link} className="w-[200px] cursor-pointer">
              {item.name}
            </RouterLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface AddMenuIconButtonProps {
  menuList?: { name: string }[];
  handleSelect?: ((item: any) => void) | null;
  iconUrl?: string;
  sizeOption?: { width?: string; height?: string; p?: string; padding?: string };
  className?: string;
}

export const AddMenuIconButton = ({
  menuList = [],
  handleSelect = null,
  iconUrl = IconPlus,
  sizeOption = { width: '36px', height: '36px', p: '7.5px' },
  className = '',
}: AddMenuIconButtonProps) => {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={t('common.addMenu')}
          className={cn('min-w-0 flex-1 p-0', className)}
        >
          <img
            src={iconUrl}
            alt={t('common.addMenu')}
            className="object-contain"
            style={{
              width: sizeOption.width,
              height: sizeOption.height,
              padding: sizeOption.padding ?? sizeOption.p,
            }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {menuList.map(item => (
          <DropdownMenuItem
            key={item.name}
            className="w-[200px]"
            onSelect={() => {
              if (handleSelect) {
                handleSelect(item);
              }
            }}
          >
            {item.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const SmallButton = props => {
  const { icon, className, ...rest } = props;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn('size-[38px] flex-none p-0 text-foreground', className)}
      {...rest}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" className="size-4">
        {icon}
      </svg>
    </Button>
  );
};

export const AddButton = props => {
  const { t } = useTranslation();
  return (
    <SmallButton
      aria-label={t('common.addItem')}
      data-add-item
      icon={
        <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />
      }
      {...props}
    />
  );
};

export const RemoveButton = props => {
  const { t } = useTranslation();
  return (
    <SmallButton
      aria-label={t('common.removeItem')}
      icon={
        <path d="M432 256c0 17.7-14.3 32-32 32L48 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l352 0c17.7 0 32 14.3 32 32z" />
      }
      {...props}
    />
  );
};

export const MenuButton = ({ menuList = [], handleSelect = null, icon, title, className = '' }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" className={cn('h-8 flex-row items-center justify-center gap-2 rounded-lg px-3.5', className)}>
          {icon}
          {title}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {menuList.map(item => (
          <DropdownMenuItem
            key={item.name}
            className="w-[200px]"
            onSelect={() => {
              if (handleSelect) {
                handleSelect(item);
              }
            }}
          >
            {item.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
