import React, { useContext } from 'react';
import Footer from '@/layouts/Footer';
import { Outlet } from 'react-router-dom';
import { LandingLogo } from '@/layouts/Header/Logo';
import { MAX_WIDTH } from '@/constant';
import { LayoutContext } from '@/contexts/LayoutContext';

const PublicLayout = props => {
  const { children } = props;
  const { fixed, footerBg } = useContext(LayoutContext);

  return (
    <div
      className={`w-full h-full flex-auto ${fixed ? 'overflow-hidden' : 'overflow-visible'}`}
      style={{ backgroundColor: footerBg || '#fff' }}
    >
      <div className="w-full mx-auto bg-white" style={{ maxWidth: MAX_WIDTH }}>
        <div className="h-16 flex items-center pl-5">
          <LandingLogo />
        </div>
        {children || <Outlet />}
      </div>
      <Footer />
    </div>
  );
};

export default PublicLayout;
