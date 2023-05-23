import React from 'react';
import { Box } from '@mui/material';
import PageTitleBox from '@/components/PageTitleBox';

function Status404() {
  return (
    <PageTitleBox title="404 Error">
      <Box sx={{ m: 'auto', fontSize: '18px', fontWeight: 600 }}>페이지를 찾을 수 없습니다.</Box>
    </PageTitleBox>
  );
}

export default Status404;
