'use client';

import DashboardModify from '@/pages/Dashboard/DashboardModify';

interface DashboardModifyPageProps {
  params: {
    dashboardId: string;
  };
}

export default function DashboardModifyPage({ params }: DashboardModifyPageProps) {
  return <DashboardModify dashboardId={params.dashboardId} />;
}