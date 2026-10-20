import React from 'react';
import { useTranslation } from 'react-i18next';
import PageTitleBox from '@/components/PageTitleBox';

function Status404() {
  const { t } = useTranslation();
  return (
    <PageTitleBox title="404 Error">
      <div className="m-auto text-lg font-semibold">{t('common.pageNotFound')}</div>
    </PageTitleBox>
  );
}

export default Status404;
