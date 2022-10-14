import React, { useEffect, useState } from 'react';
import { Box, Grid } from '@mui/material';
import TitleBox from '@/components/TitleBox';
import AddIconButton from '@/components/button/AddIconButton';
import CardList, { DataSetCard, DataSourceCard } from '@/components/CardList';
import DatabaseService from '@/api/databaseService';

const DataLayout = () => {
  const [databaseList, setDatabaseList] = useState([]);
  const [datasetList, setDatasetList] = useState([]);
  const [tableList, setTableList] = useState([]);

  // 선택한 데이터베이스를 CardList 에서 가져와서 저장하는 state
  const [selectedData, setSelectedData] = useState({
    databaseId: null,
  });

  const handleSelectDatabase = enteredData => {
    console.log('handleUpdate', enteredData);
    return setSelectedData(prevState => ({ ...prevState, ...enteredData }));
  };

  useEffect(() => {
    getDatabaseList();
  }, []);

  useEffect(() => {
    getDatabaseInfo();
  }, [selectedData.databaseId]);

  /**
   * 데이터베이스 목록조회
   */
  const getDatabaseList = () => {
    DatabaseService.selectDatabaseList().then(response => {
      console.log('selectDatabaseList', response.data);
      setDatabaseList(response.data);
    });
  };

  const getDatabaseInfo = () => {
    DatabaseService.selectDatabase(selectedData.databaseId).then(response => {
      console.log('getDatabaseInfo', response.data);
      setDatasetList(response.data.datasets);
      setTableList(response.data.tables);
    });
  };

  return (
    <Box>
      <Grid container spacing={5}>
        <Grid item xs={12} md={4}>
          <TitleBox title="데이터 소스" button={<AddIconButton link="source/create" />}>
            <DataSourceCard
              data={databaseList}
              selectedData={selectedData}
              onUpdate={handleSelectDatabase}
              minWidth="100%"
            />
          </TitleBox>
        </Grid>
        <Grid item xs={12} md>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TitleBox title="데이터 셋" button={<AddIconButton link="set/create" />}>
                <DataSetCard data={datasetList} />
              </TitleBox>
            </Grid>
            <Grid item xs={12}>
              <TitleBox title="데이터 목록">{<CardList data={tableList} disabled />}</TitleBox>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

DataLayout.defaultProps = {
  data: {},
  naviUrl: {},
};

export default DataLayout;
