import React, { useState } from 'react';
import { Box, Grid } from '@mui/material';
import TitleBox from './TitleBox';
import CardList from './CardList';
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

function DataTable(props) {
  const [selectedData, setSelectedData] = useState('');

  return (
    <Box>
      <Grid container spacing={5}>
        <Grid item xs={12} md={4}>
          <TitleBox
            title={'데이터 소스'}
            naviUrl={props.naviUrl ? props.naviUrl.dataConnectUrl : false}
            fastCreate
            edit
            delete
          >
            <CardList data={dataSource} fastCreate edit delete minWidth="100%" />
          </TitleBox>
        </Grid>
        <Grid item xs={12} md>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TitleBox title={'데이터 셋'} naviUrl={props.naviUrl ? props.naviUrl.dataSetUrl : false}>
                <CardList data={dataSet} edit delete />
              </TitleBox>
            </Grid>
            <Grid item xs={12}>
              <TitleBox title={'데이터 목록'} data={dataList}>
                <CardList data={dataList} />
              </TitleBox>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DataTable;
