import React, { useEffect, useState } from 'react';
import { Box, Grid } from '@mui/material';
import TitleBox from '@/components/TitleBox';
import AddIconButton from '@/components/button/AddIconButton';
import CardList, { DataSetCard, DataSourceCard } from '@/components/CardList';

function DataLayout({ data }) {
  // 선택한 데이터베이스를 CardList 에서 가져와서 저장하는 state
  const [selectedData, setSelectedData] = useState({
    dataSource: 0,
    dataList: '',
    dataSet: '',
  });

  const handleUpdate = enteredData => {
    return setSelectedData(prevState => ({ ...prevState, ...enteredData }));
  };

  useEffect(() => {
    data.filter((item, index) => {
      if (selectedData.dataSource === item.id) {
        const selectedArray = data[index];
        handleUpdate({ dataList: selectedArray.dataList, dataSet: selectedArray.dataSet });
        console.log(selectedData);
      }
    });
  }, [selectedData.dataSource]);

  return (
    <Box>
      <Grid container spacing={5}>
        <Grid item xs={12} md={4}>
          <TitleBox title="데이터 소스" button={<AddIconButton link="source/create" />}>
            <DataSourceCard data={data} selectedData={selectedData} onUpdate={handleUpdate} minWidth="100%" />
          </TitleBox>
        </Grid>
        <Grid item xs={12} md>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TitleBox title="데이터 셋" button={<AddIconButton link="set/create" />}>
                <DataSetCard data={selectedData.dataSet} />
              </TitleBox>
            </Grid>
            <Grid item xs={12}>
              <TitleBox title="데이터 목록">
                <CardList data={selectedData.dataList} disabled />
              </TitleBox>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

DataLayout.defaultProps = {
  data: {},
  naviUrl: {},
};

export default DataLayout;
