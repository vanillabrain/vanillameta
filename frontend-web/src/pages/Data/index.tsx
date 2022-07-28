import React from 'react';
import { Box, Grid } from '@mui/material';

import DataTable from './DataTable';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import PageTitle from '../../components/PageTitle';

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

function Data(props) {
  return (
    <Box sx={{ pb: 2 }}>
      <ResponsiveContainer>
        <PageTitle title={title} subTitle={subTitle} />
        <Box my={3}>
          <Grid container spacing={3} sx={{ justifyContent: 'space-between', minHeight: 700 }}>
            <Grid item xs={3}>
              <DataTable title={'데이터 소스'} data={dataSource} dropMenu fastCreate edit delete />
            </Grid>
            <Grid item xs={8} spacing={3}>
              <Grid item>
                <DataTable title={'데이터 셋'} data={dataSet} dropMenu edit delete cardWidth="30%" />
              </Grid>
              <Grid item>
                <DataTable title={'데이터 목록'} data={dataList} cardWidth="30%" />
              </Grid>
            </Grid>
          </Grid>
        </Box>
      </ResponsiveContainer>
    </Box>
  );
}

export default Data;
