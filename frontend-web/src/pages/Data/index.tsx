import React, { useEffect, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import DataLayout from './DataLayout';
// import { get } from '@/helpers/apiHelper';
import axios from 'axios';

function Data() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedData, setLoadedData] = useState([]);

  return (
    <PageContainer>
      <DataLayout />
    </PageContainer>
  );
}

export default Data;
