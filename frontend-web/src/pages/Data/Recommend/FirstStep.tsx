import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack, Typography } from '@mui/material';
import TitleBox from '@/components/TitleBox';
import SmallCardList from '@/components/SmallCardList';

function FirstStep(props) {
  const { t } = useTranslation();
  const { data } = props;

  return (
    <Stack p={4} pb={0} spacing={3}>
      <Typography mb={2}>{t('dataRecommend2.guideData')}</Typography>
      <Box>
        <TitleBox title={t('dataRecommend2.dataset')}>
          <SmallCardList data={data.dataSet} />
        </TitleBox>
      </Box>
      <Box>
        <TitleBox title={t('dataRecommend2.dataList')}>
          <SmallCardList data={data.dataList} />
        </TitleBox>
      </Box>
    </Stack>
  );
}

export default FirstStep;
