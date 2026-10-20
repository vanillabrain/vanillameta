import React, { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Footer from '@/layouts/Footer';
import { LandingLogo } from '@/layouts/Header/Logo';
import { MAX_WIDTH } from '@/constant';
import { LayoutContext } from '@/contexts/LayoutContext';
import { cn } from '@/lib/utils';

const PublicLayout = props => {
  const { children } = props;
  const { fixed, footerBg } = useContext(LayoutContext);

  return (
    <div
      className={cn('h-full w-full flex-1', fixed ? 'overflow-hidden' : 'overflow-visible')}
      style={{ backgroundColor: footerBg ? footerBg : '#fff' }}
    >
      <div className="mx-auto flex w-full flex-col bg-background" style={{ maxWidth: MAX_WIDTH }}>
        <div className="flex h-[65px] flex-col justify-center pl-5">
          <LandingLogo />
        </div>
        {children || <Outlet />}
      </div>
      <Footer />
    </div>
  );
};

export default PublicLayout;
