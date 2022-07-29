import React from 'react';
import { Box, styled } from '@mui/material';
import DataTable from './DataTable';

const title = '데이터';
const subTitle = 'Data';

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
  padding: theme.spacing(1),
  display: 'flex',
  rowGap: '30px',

  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
  },

  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    display: 'flex',
    columnGap: '60px',

    '& > .MuiBox-root:nth-of-type(2n-1) ': {
      width: '30%',
    },
    '& > .MuiBox-root:nth-of-type(2n) ': {
      width: '70%',
      ul: { display: 'flex', flexWrap: 'wrap', columnGap: 12 },
      li: { width: 'calc(50% - 8px)', marginBottom: 0 },
    },
  },

  [theme.breakpoints.up('md')]: {
    flexDirection: 'row',
    display: 'flex',
    columnGap: '60px',

    '& > .MuiBox-root:nth-of-type(2n-1) ': {
      width: '27%',
    },
    '& > .MuiBox-root:nth-of-type(2n) ': {
      width: '73%',
      ul: { display: 'flex', flexWrap: 'wrap', columnGap: 12 },
      li: { width: 'calc(33.3333% - 8px)', marginBottom: 0 },
    },
  },
}));

function Data(props) {
  return (
    <Box sx={{ p: 4, px: 8 }}>
      <Box>
        <ResponsiveDiv>
          <DataTable title={'데이터 소스'} data={dataSource} dropMenu fastCreate edit delete />
          <Box sx={{ display: 'flex', flexDirection: 'column', rowGap: 5 }}>
            <DataTable title={'데이터 셋'} data={dataSet} dropMenu edit delete />
            <DataTable title={'데이터 목록'} data={dataList} />
          </Box>
        </ResponsiveDiv>
      </Box>
    </Box>
  );
}

export default Data;
