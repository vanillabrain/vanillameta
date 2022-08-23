import React, { useEffect, useState } from 'react';
import PageContainer from '../../components/PageContainer';
import DataLayout from './DataLayout';

const dataSourceUrl = '/data/source';
const dataSetUrl = '/data/set';
const naviUrl = { dataSourceUrl, dataSetUrl };

function Data(props) {
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
      <DataLayout data={loadedData} naviUrl={naviUrl} />
    </PageContainer>
  );
}

export default Data;
