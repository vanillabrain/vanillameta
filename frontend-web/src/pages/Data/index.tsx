import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import DataLayout from './DataLayout';
// import { get } from '@/helpers/apiHelper';
import axios from 'axios';

function Data() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedData, setLoadedData] = useState([]);

  useEffect(() => {
    axios
      .get('/data/dummyDataList.json')
      .then(response => response.data)
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
