import React, { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/layouts/Header';
import Footer from '@/layouts/Footer';
import { LayoutContext } from '@/contexts/LayoutContext';
import { cn } from '@/lib/utils';

const Layout = props => {
  const { children } = props;
  const { fixed, footerBg } = useContext(LayoutContext);

  return (
    <div
      className={cn('flex min-h-dvh w-full flex-col', fixed ? 'h-dvh overflow-hidden' : 'overflow-visible')}
      style={{ backgroundColor: footerBg ? footerBg : '#fff' }}
    >
      <Header />
      <div className="flex min-h-0 w-full flex-1 flex-col pt-[108px] sm:pt-16">{children || <Outlet />}</div>
      <Footer />
    </div>
  );
};

export default Layout;
