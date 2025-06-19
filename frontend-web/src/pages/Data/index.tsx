import React from 'react';
import DataLayout from './DataLayout';
import PageTitleBox from '@/components/PageTitleBox';
import Seo from '@/seo/Seo';
import { useTranslation } from 'react-i18next';

/**
 * 데이터 관리 페이지
 * @constructor
 */

const Data = () => {
  const { t } = useTranslation('navigation');
  return (
    <PageTitleBox title={t('data')} sx={{ paddingLeft: 0, paddingRight: 0, width: '100%', height: '100%' }}>
      <Seo title={t('data')} />
      <DataLayout />
    </PageTitleBox>
  );
};

export default Data;
