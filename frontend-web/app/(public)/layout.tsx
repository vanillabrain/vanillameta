import React from 'react';
import Footer from '@/layouts/Footer';
import { LandingLogo } from '@/layouts/Header/Logo';
import { MAX_WIDTH } from '@/constant';

// 공개 페이지용 레이아웃 (로그인 없이 접근 가능)
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full flex-auto overflow-visible bg-white">
      <div className="w-full mx-auto bg-white" style={{ maxWidth: MAX_WIDTH }}>
        <div className="h-16 flex items-center pl-5">
          <LandingLogo />
        </div>
        {children}
      </div>
      <Footer />
    </div>
  );
}