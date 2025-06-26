import React, { useContext } from 'react';
import Header from '@/layouts/Header';
import Footer from '@/layouts/Footer';
import { LayoutContext } from '@/contexts/LayoutContext';
import { Outlet } from 'react-router-dom';

const Layout = props => {
  const { children } = props;
  const { fixed, footerBg } = useContext(LayoutContext);

  return (
    <div
      className={`w-full h-full flex-auto ${fixed ? 'overflow-hidden' : 'overflow-visible'}`}
      style={{ backgroundColor: footerBg || '#fff' }}
    >
      <Header />
      <div className="flex-auto w-full pt-14 sm:pt-16 min-h-[calc(100%-50px)]">{children || <Outlet />}</div>
      <Footer />
    </div>
  );
};

export default Layout;
