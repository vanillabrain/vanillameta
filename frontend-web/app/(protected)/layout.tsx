import React from 'react';
import Header from '@/layouts/Header';
import Footer from '@/layouts/Footer';

// 보호된 라우트용 레이아웃
// 인증 확인은 middleware.ts에서 처리됨
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // LayoutContext는 client component에서 처리
  return (
    <div className="w-full h-full flex-auto overflow-visible bg-white">
      <Header />
      <div className="flex-auto w-full pt-14 sm:pt-16 min-h-[calc(100%-50px)]">
        {children}
      </div>
      <Footer />
    </div>
  );
}