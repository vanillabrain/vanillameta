import React from 'react';
import PageContainer from '../../components/PageContainer';
import DataTable from '../../components/DataTable';

const dataConnectUrl = '/data/connect';
const dataSetUrl = '/data/set';
const naviUrl = { dataConnectUrl, dataSetUrl };

function Data(props) {
  return (
    <PageContainer>
      <DataTable naviUrl={naviUrl} />
    </PageContainer>
  );
}

export default Data;
