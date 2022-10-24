import React, { useEffect, useState } from 'react';
import { Box, Grid } from '@mui/material';
import TitleBox from '@/components/TitleBox';
import AddIconButton from '@/components/button/AddIconButton';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { DatabaseCardList } from '@/components/list/DatabaseCardList';
import { DatasetCardList } from '@/components/list/DatasetCardList';
import CardList from '@/components/list/CardList';

const DataLayout = props => {
  const { isViewMode, setDataSet } = props;
  const [databaseList, setDatabaseList] = useState([]);
  const [datasetList, setDatasetList] = useState([]);
  const [tableList, setTableList] = useState([]);
  const alert = useAlert();

  // 선택한 데이터베이스를 CardList 에서 가져와서 저장하는 state
  const [selectedDatabase, setSelectedDatabase] = useState({
    databaseId: null,
  });

  const handleSelectDatabase = enteredData => {
    return setSelectedDatabase(prevState => ({ ...prevState, ...enteredData }));
  };

  useEffect(() => {
    getDatabaseList();
  }, []);

  useEffect(() => {
    if (selectedDatabase.databaseId) getDatabaseInfo();
  }, [selectedDatabase.databaseId]);

  /**
   * 데이터베이스 목록조회
   */
  const getDatabaseList = () => {
    DatabaseService.selectDatabaseList().then(response => {
      setDatabaseList(response.data.data);
      if (response.data.data.length > 0) {
        setSelectedDatabase({ databaseId: response.data.data[0].id });
      }
    });
  };

  const getDatabaseInfo = () => {
    DatabaseService.selectDatabase(selectedDatabase.databaseId).then(response => {
      setDatasetList(response.data.data.datasets);
      setTableList(response.data.data.tables);
    });
  };

  const removeDatabase = (id, name) => {
    console.log('removeDatabase', id);
    alert.success(`${name} 데이터베이스를 삭제하시겠습니까?`, {
      title: '데이터베이스 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => {
            DatabaseService.deleteDatabase(id).then(response => {
              if (response.data.status === STATUS.SUCCESS) {
                getDatabaseList();
                console.log(`${name} 데이터 베이스 삭제!`);
              }
            });
          },
        },
      ],
    });
  };

  const selectDataset = (datasetType, item) => {
    const data = {
      databaseId: item.databaseId,
      datasetType: datasetType,
      datasetId: item.id,
    };
    setDataSet(data);
    console.log('selectDataset', data);
  };

  return (
    <Box>
      <Grid container spacing={5}>
        <Grid item xs={12} md={4}>
          <TitleBox title="데이터 소스" button={<AddIconButton link="source/create" />}>
            <DatabaseCardList
              data={databaseList}
              selectedData={selectedDatabase}
              disabledIcons={!!isViewMode}
              onUpdate={handleSelectDatabase}
              onRemove={removeDatabase}
              minWidth="100%"
            />
          </TitleBox>
        </Grid>
        <Grid item xs={12} md>
          <Grid container spacing={5}>
            <Grid item xs={12}>
              <TitleBox title="데이터 셋" button={<AddIconButton link={`set/create/${selectedDatabase.databaseId}`} />}>
                <DatasetCardList data={datasetList} selectDataset={selectDataset} disabledIcons={!!isViewMode} />
              </TitleBox>
            </Grid>
            <Grid item xs={12}>
              <TitleBox title="데이터 목록">
                {<CardList data={tableList} disabled selectDataset={selectDataset} disabledIcons={!!isViewMode} />}
              </TitleBox>
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
