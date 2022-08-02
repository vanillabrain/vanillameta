import React from 'react';
import { Box, styled } from '@mui/material';
import FrameItemBox from '../../components/FrameItemBox';
import CardList from '../../components/CardList';

const title = '데이터';
const subTitle = 'Data';
const navigateUrl = '/data/connect';

const dataSource = [
  { key: 0, label: '데이터베이스 1' },
  { key: 1, label: '데이터베이스 2' },
  { key: 2, label: '데이터베이스 3' },
];
const dataSet = [
  { key: 0, label: '데이터 셋 1' },
  { key: 1, label: '데이터 셋 2' },
  { key: 2, label: '데이터 셋 3' },
  { key: 3, label: '데이터 셋 4' },
  { key: 4, label: '데이터 셋 5' },
];
const dataList = [
  { key: 0, label: '데이터 목록 1' },
  { key: 1, label: '데이터 목록 2' },
  { key: 2, label: '데이터 목록 3' },
  { key: 3, label: '데이터 목록 4' },
  { key: 4, label: '데이터 목록 5' },
  { key: 5, label: '데이터 목록 6' },
  { key: 6, label: '데이터 목록 7' },
];

const ResponsiveDiv = styled('div')(({ theme }) => ({
  display: 'flex',
  rowGap: theme.spacing(3),

  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
  },

  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    display: 'flex',
    columnGap: theme.spacing(7),
    ul: { display: 'flex', columnGap: 12 },
    li: { marginBottom: 0 },

    '& > .MuiBox-root:nth-of-type(2n-1) ': {
      width: '30%',
      ul: { flexDirection: 'column' },
    },
    '& > .MuiBox-root:nth-of-type(2n) ': {
      width: '70%',
      ul: { flexWrap: 'wrap' },
      li: { width: 'calc(50% - 8px)' },
    },
  },

  [theme.breakpoints.up('md')]: {
    flexDirection: 'row',
    display: 'flex',
    columnGap: theme.spacing(8),
    ul: { display: 'flex', columnGap: 12 },
    li: { marginBottom: 0 },

    '& > .MuiBox-root:nth-of-type(2n-1) ': {
      width: '27%',
    },
    '& > .MuiBox-root:nth-of-type(2n) ': {
      width: '73%',
      ul: { flexWrap: 'wrap' },
      li: { width: 'calc(33.3333% - 8px)' },
    },
  },
}));

function Data() {
  return (
    <Box sx={{ p: 4, px: 8 }}>
      <Box>
        <ResponsiveDiv>
          <FrameItemBox title={'데이터 소스'} menuNavigate={navigateUrl} fastCreate edit delete>
            <CardList data={dataSource} fastCreate edit delete />
          </FrameItemBox>
          <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 5 }}>
            <FrameItemBox title={'데이터 셋'}>
              <CardList data={dataSet} edit delete />
            </FrameItemBox>
            <FrameItemBox title={'데이터 목록'} data={dataList}>
              <CardList data={dataList} />
            </FrameItemBox>
          </Box>
        </ResponsiveDiv>
      </Box>
    </Box>
  );
}

export default Data;
