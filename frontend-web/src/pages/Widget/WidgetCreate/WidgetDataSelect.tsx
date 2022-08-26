import React, { useEffect, useState } from 'react';
import { Box, Grid } from '@mui/material';
import TitleBox from '@/components/TitleBox';
import CardList, { DataSetCard, DataSourceCard } from '@/components/CardList';

function WidgetDataSelect(props) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadedData, setLoadedData] = useState([]);

  // data fetch
  useEffect(() => {
    fetch('/data/dummyDataList.json')
      .then(response => response.json())
      .then(data => setLoadedData(data));
    setIsLoading(true);
  }, []);

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
    loadedData.filter((item, index) => {
      if (selectedData.dataSource === item.id) {
        const selectedArray = loadedData[index];
        handleUpdate({ dataList: selectedArray.dataList, dataSet: selectedArray.dataSet });
        console.log(selectedData);
      }
    });
  }, [selectedData.dataSource]);

  return (
    <Box>
      <Grid container spacing={5}>
        <Grid item xs={12} md={4}>
          <TitleBox title={'데이터 소스'}>
            <DataSourceCard
              data={loadedData}
              selectedData={selectedData}
              onUpdate={handleUpdate}
              minWidth="100%"
              disabledIcons
            />
          </TitleBox>
        </Grid>
        <Grid item xs={12} md>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TitleBox title={'데이터 셋'}>
                <DataSetCard data={selectedData.dataSet} disabledIcons />
              </TitleBox>
            </Grid>
            <Grid item xs={12}>
              <TitleBox title={'데이터 목록'}>
                <CardList data={selectedData.dataList} disabled />
              </TitleBox>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

export default WidgetDataSelect;
