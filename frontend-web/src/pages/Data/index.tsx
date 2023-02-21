import React from 'react';
import PageContainer from '@/components/PageContainer';
import DataLayout from './DataLayout';
import PageTitleBox from '@/components/PageTitleBox';
import Seo from '@/seo/Seo';

/**
 * 데이터 관리 페이지
 * @constructor
 */

const title = '데이터';

const Data = () => {
  return (
    <PageContainer>
      <Seo title={title} />

      <PageTitleBox title={title} sx={{ paddingLeft: 0, paddingRight: 0, width: '100%', height: '100%' }}>
        <DataLayout />
      </PageTitleBox>
    </PageContainer>
  );
};

export default Data;
