import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Plus, Minus } from 'lucide-react';
import IconPlus from '@/assets/images/icon/btn-plus.svg';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const menuWidth = 200;

const AddIconButton = ({ link = '', ...props }) => {
  return (
    <Button asChild variant="ghost" size="icon" {...props}>
      <RouterLink to={link}>
        <Plus className="w-7 h-7" />
      </RouterLink>
    </Button>
  );
};

export default AddIconButton;

export const AddMenuButton = ({ menuList, label }) => {
  const matches = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={matches ? "default" : "icon"}>
          {matches ? (
            <>
              <Plus className="mr-2 h-4 w-4" />
              {label}
            </>
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]">
        {menuList.map(item => (
          <DropdownMenuItem key={item.name} asChild>
            <RouterLink to={item.link}>
              {item.name}
            </RouterLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
AddMenuButton.defaultProps = {
  menuList: {
    name: '',
    link: '',
  },
};

export const AddMenuIconButton = ({
  menuList,
  handleSelect = null,
  iconUrl = IconPlus,
  sizeOption = { width: '36px', height: '36px', p: '7.5px' },
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="flex-auto">
          <img 
            src={iconUrl} 
            style={sizeOption} 
            alt="추가메뉴" 
            className="object-contain"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]">
        {menuList.map(item => (
          <DropdownMenuItem 
            key={item.name} 
            onClick={() => handleSelect && handleSelect(item)}
          >
            {item.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
AddMenuIconButton.defaultProps = {
  menuList: {
    name: '',
  },
};

export const SmallButton = props => {
  const { icon, ...rest } = props;

  return (
    <Button variant="ghost" size="icon" className="w-[38px] h-[38px] flex-none" {...rest}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="#141414" className="w-4 h-4">
        {icon}
      </svg>
    </Button>
  );
};

export const AddButton = props => {
  return (
    <SmallButton
      icon={
        <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />
      }
      {...props}
    />
  );
};

export const RemoveButton = props => {
  return (
    <SmallButton
      icon={
        <path d="M432 256c0 17.7-14.3 32-32 32L48 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l352 0c17.7 0 32 14.3 32 32z" />
      }
      {...props}
    />
  );
};

export const MenuButton = ({ menuList, handleSelect = null, icon, title, sizeOption = { width: 22, height: 22 } }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="bg-[#043f84] hover:bg-[#0f5ab2] border-[#0f5ab2] h-8 px-3.5 rounded-lg"
        >
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]">
        {menuList.map(item => (
          <DropdownMenuItem 
            key={item.name} 
            onClick={() => handleSelect && handleSelect(item)}
          >
            {item.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
MenuButton.defaultProps = {
  menuList: {
    name: '',
  },
};
