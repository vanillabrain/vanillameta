import React from 'react';
import PageContainer from '@/components/PageContainer';
import DataLayout from './DataLayout';
import PageTitleBox from '@/components/PageTitleBox';

/**
 * 데이터 관리 페이지
 * @constructor
 */
function DataPage() {
  return (
    <PageContainer>
      <PageTitleBox title="데이터" sx={{ paddingLeft: 0, paddingRight: 0, width: '100%', height: '100%' }}>
        <DataLayout />
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataPage;
