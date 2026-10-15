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
      className={cn('h-full w-full flex-1', fixed ? 'overflow-hidden' : 'overflow-visible')}
      style={{ backgroundColor: footerBg ? footerBg : '#fff' }}
    >
      <Header />
      <div className="flex w-full flex-1 flex-col pt-14 sm:pt-[65px]" style={{ minHeight: 'calc(100% - 50px)' }}>
        {children || <Outlet />}
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
