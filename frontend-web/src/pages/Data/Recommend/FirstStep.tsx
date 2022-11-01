import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import TitleBox from '@/components/TitleBox';
import SmallCardList from '@/components/SmallCardList';

function FirstStep(props) {
  const { data } = props;

  return (
    <Stack p={4} pb={0} spacing={3}>
      <Typography mb={2}>대시보드 생성에 사용할 데이터를 선택하세요.</Typography>
      <Box>
        <TitleBox title={'데이터 셋'}>
          <SmallCardList data={data.dataSet} />
        </TitleBox>
      </Box>
      <Box>
        <TitleBox title={'데이터 목록'}>
          <SmallCardList data={data.dataList} />
        </TitleBox>
      </Box>
    </Stack>
  );
}

export default FirstStep;
