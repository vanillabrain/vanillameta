'use client';

import DataSet from '@/pages/Data/DataSet';

interface DataSetModifyPageProps {
  params: {
    setId: string;
  };
}

export default function DataSetModifyPage({ params }: DataSetModifyPageProps) {
  return <DataSet setId={params.setId} />;
}