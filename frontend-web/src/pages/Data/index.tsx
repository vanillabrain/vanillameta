import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import DataLayout from './DataLayout';

function Data() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedData, setLoadedData] = useState([]);

  useEffect(() => {
    fetch('/data/dummyDataList.json')
      .then(response => response.json())
      .then(data => setLoadedData(data));
    setIsLoading(true);
  }, []);

  return (
    <PageContainer>
      <DataLayout data={loadedData} />
    </PageContainer>
  );
}

export default Data;
