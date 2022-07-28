import React from 'react';
import { Box, Grid } from '@mui/material';

import DataTable from './DataTable';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import PageTitle from '../../components/PageTitle';

function Data(props) {
  return (
    <Box sx={{ pb: 2 }}>
      <ResponsiveContainer>
        <PageTitle title="Data" />
        <Box my={3}>
          <Grid container spacing={3} sx={{ minHeight: 700 }}>
            <Grid item xs={4}>
              <DataTable title={'데이터 소스'} dropMenu fastCreate edit />
            </Grid>
            <Grid item container xs={8} spacing={3}>
              <Grid item>
                <DataTable title={'데이터 셋'} dropMenu edit />
              </Grid>
              <Grid item>
                <DataTable title={'데이터 목록'} />
              </Grid>
            </Grid>
          </Grid>
        </Box>
      </ResponsiveContainer>
    </Box>
  );
}

export default Data;
