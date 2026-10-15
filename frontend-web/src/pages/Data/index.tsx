import React from 'react';
import { useTranslation } from 'react-i18next';
import DataLayout from './DataLayout';
import PageTitleBox from '@/components/PageTitleBox';
import Seo from '@/seo/Seo';

/**
 * 데이터 관리 페이지
 * @constructor
 */

const Data = () => {
  const { t } = useTranslation();
  const title = t('common.data');
  return (
    <PageTitleBox title={title} className="h-full w-full p-0">
      <Seo title={title} />
      <DataLayout />
    </PageTitleBox>
  );
};

export default Data;
