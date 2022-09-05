import React, { useEffect, useState } from 'react';
import { Box, Grid } from '@mui/material';
import TitleBox from '@/components/TitleBox';
import CardList, { DataSetCard, DataSourceCard } from '@/components/CardList';

function WidgetDataSelect(props) {
  const { onUpdate, ...rest } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [loadedData, setLoadedData] = useState([]);
  const [selectedData, setSelectedData] = useState(null);

  // data fetch
  useEffect(() => {
    fetch('/data/dummyDataList.json')
      .then(response => response.json())
      .then(data => setLoadedData(data));
    setIsLoading(true);
  }, []);

  // 선택한 데이터베이스를 CardList에서 가져와서 저장하고 dataSet과 dataList를 보여주는 state
  const [presentedData, setPresentedData] = useState({
    dataSource: 0,
    dataList: '',
    dataSet: '',
  });

  const handleUpdate = enteredData => {
    // DataSource 클릭하면 실행
    if (typeof enteredData === 'object') {
      setPresentedData(prevState => ({ ...prevState, ...enteredData }));
    }

    // DataSet of DataList 클릭하면 실행
    if (typeof enteredData === 'number') {
      onUpdate({ dataSource: presentedData.dataSource, dataId: enteredData });
    }
  };

  useEffect(() => {
    loadedData.filter((item, index) => {
      if (presentedData.dataSource === item.id) {
        const selectedArray = loadedData[index];
        handleUpdate({ dataList: selectedArray.dataList, dataSet: selectedArray.dataSet });
        // console.log(presentedData);
      }
    });
  }, [presentedData.dataSource]);

  const handleSelectDataset = datesetId => {
    setSelectedData(datesetId);
  };

  return (
    <Box>
      <Grid container spacing={5}>
        <Grid item xs={12} md={4}>
          <TitleBox title="데이터 소스">
            <DataSourceCard
              data={loadedData}
              selectedData={presentedData}
              onUpdate={handleUpdate}
              minWidth="100%"
              disabledIcons
            />
          </TitleBox>
        </Grid>
        <Grid item xs={12} md>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TitleBox title="데이터 셋">
                <CardList data={presentedData.dataSet} onUpdate={handleUpdate} />
              </TitleBox>
            </Grid>
            <Grid item xs={12}>
              <TitleBox title="데이터 목록">
                <CardList data={presentedData.dataList} onUpdate={handleUpdate} />
              </TitleBox>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

export default WidgetDataSelect;
