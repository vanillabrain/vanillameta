import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import DataLayout from './DataLayout';
import { get } from '@/helpers/apiHelper';

function Data() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedData, setLoadedData] = useState([]);

  useEffect(() => {
    get('/data/dummyDataList.json')
      .then(response => response.data.json())
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
