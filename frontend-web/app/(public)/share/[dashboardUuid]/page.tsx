'use client';

import Share from '@/pages/Share';

interface SharePageProps {
  params: {
    dashboardUuid: string;
  };
}

export default function SharePage({ params }: SharePageProps) {
  // Share 컴포넌트에 dashboardUuid 전달
  return <Share dashboardUuid={params.dashboardUuid} />;
}