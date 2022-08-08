import React from 'react';
import { Box, Grid } from '@mui/material';
import TitleBox from '../../components/TitleBox';
import CardList from '../../components/CardList';

function WidgetDataSelect(props) {
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
            <CardList data={props.dataSource} minWidth="100%" />
          </TitleBox>
        </Grid>
        <Grid item xs={12} md>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TitleBox title={'데이터 셋'} naviUrl={props.naviUrl ? props.naviUrl.dataSetUrl : false}>
                <CardList data={props.dataSet} />
              </TitleBox>
            </Grid>
            <Grid item xs={12}>
              <TitleBox title={'데이터 목록'} data={props.dataList}>
                <CardList data={props.dataList} />
              </TitleBox>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

export default WidgetDataSelect;
