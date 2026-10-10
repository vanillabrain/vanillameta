import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import PageTitleBox from '@/components/PageTitleBox';

function Status404() {
  const { t } = useTranslation();
  return (
    <PageTitleBox title="404 Error">
      <Box sx={{ m: 'auto', fontSize: '18px', fontWeight: 600 }}>{t('common.pageNotFound')}</Box>
    </PageTitleBox>
  );
}

export default Status404;
