'use client';

import DashboardView from '@/pages/Dashboard/DashboardView';

interface DashboardViewPageProps {
  params: {
    dashboardId: string;
  };
}

export default function DashboardViewPage({ params }: DashboardViewPageProps) {
  return <DashboardView dashboardId={params.dashboardId} />;
}