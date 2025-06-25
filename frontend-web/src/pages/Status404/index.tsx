import React from 'react';
import { Box } from '@/components/ui';
import PageTitleBox from '@/components/PageTitleBox';

function Status404() {
  return (
    <PageTitleBox title="404 Error">
      <Box className="mx-auto text-lg font-semibold">페이지를 찾을 수 없습니다.</Box>
    </PageTitleBox>
  );
}

export default Status404;
