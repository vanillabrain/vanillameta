import React, { useEffect, useState } from 'react';
import { Box, Grid, IconButton } from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import TitleBox from '../../components/TitleBox';
import Recommend from './Recommend';
import CardList, { IconCardList, DataSetCard, DataSourceCard } from '../../components/CardList';
import DataSource from '@/pages/Data/DataSource';

function DataLayout({ data, naviUrl }) {
  const navigate = useNavigate();

  // 선택한 데이터베이스를 CardList 에서 가져와서 저장하는 state
  const [selectedData, setSelectedData] = useState({
    dataSource: 0,
    dataList: '',
    dataSet: '',
  });

  const handleUpdate = enteredData => {
    return setSelectedData(prevState => ({ ...prevState, ...enteredData }));
  };
  console.log(selectedData);

  useEffect(() => {
    data.filter((item, index) => {
      if (selectedData.dataSource === item.id) {
        const selectedArray = data[index];
        handleUpdate({ dataList: selectedArray.dataList, dataSet: selectedArray.dataSet });
        console.log(selectedData);
      }
    });
  }, [selectedData.dataSource]);

  const handleDataListClick = event => {
    // selectedData.event.target.value;
  };

  // 아이콘 버튼 그룹 컴포넌트
  const dataSetIconButton = (
    <React.Fragment>
      <IconButton size="small" component={RouterLink} to={`/data/set/${selectedData.dataSource}`}>
        <Edit />
      </IconButton>
      <IconButton size="small">
        <Delete />
      </IconButton>
    </React.Fragment>
  );

  const dataSourceIconButton = (
    <React.Fragment>
      <Recommend
      // selected={}
      // link={`/data/recommend/${selectedData.dataSource}`}
      />
      <IconButton size="small" component={RouterLink} to={`/data/source/${selectedData.dataSource}`}>
        <Edit />
      </IconButton>
      <IconButton size="small">
        <Delete />
      </IconButton>
    </React.Fragment>
  );

  return (
    <Box>
      <Grid container spacing={5}>
        <Grid item xs={12} md={4}>
          <TitleBox title="데이터 소스" naviUrl={naviUrl.dataSourceUrl}>
            {/*<IconCardList*/}
            {/*  data={data}*/}
            {/*  selectedData={selectedData}*/}
            {/*  button={dataSourceIconButton}*/}
            {/*  minWidth="100%"*/}
            {/*  onUpdate={handleUpdate}*/}
            {/*/>*/}
            <DataSourceCard data={data} selectedData={selectedData} minWidth="100%" onUpdate={handleUpdate} />
          </TitleBox>
        </Grid>
        <Grid item xs={12} md>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TitleBox title="데이터 셋" naviUrl={naviUrl.dataSetUrl}>
                {/*<IconCardList data={selectedData.dataSet} button={dataSetIconButton} disabled />*/}
                <DataSetCard data={selectedData.dataSet} />
              </TitleBox>
            </Grid>
            <Grid item xs={12}>
              <TitleBox title="데이터 목록">
                <CardList data={selectedData.dataList} onClick={handleDataListClick} disabled />
                {/*<DataSourceCard data={selectedData.dataList} />*/}
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
