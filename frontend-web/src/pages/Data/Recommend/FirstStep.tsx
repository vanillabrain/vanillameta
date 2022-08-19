import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import TitleBox from '../../../components/TitleBox';
import SmallCardList from '../../../components/SmallCardList';

const dataSource = [
  { key: 0, label: '데이터베이스 1', value: '데이터베이스 1' },
  { key: 1, label: '데이터베이스 2', value: '데이터베이스 2' },
  { key: 2, label: '데이터베이스 3', value: '데이터베이스 3' },
];
const dataSet = [
  { key: 0, label: '데이터 셋 1', value: '데이터 셋 1' },
  { key: 1, label: '데이터 셋 2', value: '데이터 셋 2' },
  { key: 2, label: '데이터 셋 3', value: '데이터 셋 3' },
  { key: 3, label: '데이터 셋 4', value: '데이터 셋 4' },
  { key: 4, label: '데이터 셋 5', value: '데이터 셋 5' },
];

function FirstStep(props) {
  return (
    <Stack p={4} pb={0} spacing={3}>
      <Typography mb={2}>대시보드 생성에 사용할 데이터를 선택하세요.</Typography>
      <Box>
        <TitleBox title={'데이터 셋'}>
          <SmallCardList data={dataSet} />
        </TitleBox>
      </Box>
      <Box>
        <TitleBox title={'데이터 소스'}>
          <SmallCardList data={dataSource} />
        </TitleBox>
      </Box>
    </Stack>
  );
}

export default FirstStep;
