'use client';

import DataSet from '@/pages/Data/DataSet';

interface DataSetCreatePageProps {
  params: {
    sourceId: string;
  };
}

export default function DataSetCreatePage({ params }: DataSetCreatePageProps) {
  return <DataSet sourceId={params.sourceId} />;
}