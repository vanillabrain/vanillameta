import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import IconLogo from '@/assets/images/logo.svg?react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

export const LandingLogo = ({ className, ...rest }: LogoProps & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn('h-[50px] w-[105px]', className)} {...rest}>
      <a href="https://vanillameta.net" target="_blank" rel="noreferrer">
        <IconLogo className="h-full w-full" />
      </a>
    </div>
  );
};

const Logo = ({ className, ...rest }: LogoProps & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn('h-[50px] w-[105px]', className)} {...rest}>
      <RouterLink to="/" aria-label="VanillaMeta">
        <IconLogo className="h-full w-full" />
      </RouterLink>
    </div>
  );
};

export default Logo;
