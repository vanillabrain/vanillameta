'use client';

import DataSource from '@/pages/Data/DataSource';

interface DataSourceModifyPageProps {
  params: {
    sourceId: string;
  };
}

export default function DataSourceModifyPage({ params }: DataSourceModifyPageProps) {
  return <DataSource sourceId={params.sourceId} />;
}