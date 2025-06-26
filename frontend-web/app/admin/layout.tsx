'use client';

import React from 'react';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import '@/components/admin/AdminLayout.css';

// Admin 레이아웃 - 관리자 권한 확인 필요
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 권한 확인 로직은 middleware에서 처리하거나
  // 별도의 client component에서 처리
  
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        <AdminHeader />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}