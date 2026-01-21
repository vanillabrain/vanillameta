import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ReactComponent as IconLogo } from '@/assets/images/logo.svg';

export const LandingLogo = props => {
  const { className, ...rest } = props;
  return (
    <div className={`w-[105px] h-[50px] ${className || ''}`} {...rest}>
      <a href="https://vanillameta.net" target="_blank" rel="noopener noreferrer">
        <IconLogo style={{ width: '100%', height: '100%' }} />
      </a>
    </div>
  );
};

const Logo = props => {
  const { className, ...rest } = props;
  return (
    <div className={`w-[105px] h-[50px] ${className || ''}`} {...rest}>
      <RouterLink to="/">
        <IconLogo style={{ width: '100%', height: '100%' }} />
      </RouterLink>
    </div>
  );
};

export default Logo;
