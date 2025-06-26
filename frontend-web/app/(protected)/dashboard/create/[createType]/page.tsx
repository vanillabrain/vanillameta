'use client';

import DashboardCreate from '@/pages/Dashboard/DashboardCreate';

interface DashboardCreateTypePageProps {
  params: {
    createType: string;
  };
}

export default function DashboardCreateTypePage({ params }: DashboardCreateTypePageProps) {
  return <DashboardCreate createType={params.createType} />;
}