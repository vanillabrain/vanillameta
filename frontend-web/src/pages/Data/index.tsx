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
    <PageTitleBox title={t('data')} className="!px-0">
      <Seo title={t('data')} />
      <DataLayout />
    </PageTitleBox>
  );
};

export default Data;
