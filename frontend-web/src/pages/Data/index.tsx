import React from 'react';
import { Box, Grid, styled } from '@mui/material';
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

function Data() {
  return (
    <Box sx={{ p: 4, px: 8 }}>
      <Box>
        <Grid container spacing={5}>
          <Grid item xs={12} md={4}>
            <FrameItemBox title={'데이터 소스'} menuNavigate={navigateUrl} fastCreate edit delete>
              <CardList data={dataSource} fastCreate edit delete minWidth="100%" />
            </FrameItemBox>
          </Grid>
          <Grid item xs={12} md>
            <Grid container spacing={5}>
              <Grid item xs={12}>
                <FrameItemBox title={'데이터 셋'}>
                  <CardList data={dataSet} edit delete />
                </FrameItemBox>
              </Grid>
              <Grid item xs={12}>
                <FrameItemBox title={'데이터 목록'} data={dataList}>
                  <CardList data={dataList} />
                </FrameItemBox>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default Data;
