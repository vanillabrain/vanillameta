import React, { useEffect, useState } from 'react';
import { Box, Grid } from '@mui/material';
import TitleBox from '@/components/TitleBox';
import AddIconButton from '@/components/button/AddIconButton';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { DatabaseCardList } from '@/components/list/DatabaseCardList';
import { DatasetCardList } from '@/components/list/DatasetCardList';
import DatasetService from '@/api/datasetService';

const DataLayout = props => {
  const { isViewMode, setDataSet } = props;
  const [databaseList, setDatabaseList] = useState([]);
  const [datasetList, setDatasetList] = useState([]);
  const [tableList, setTableList] = useState([]);
  const alert = useAlert();

  const [selectedDatabase, setSelectedDatabase] = useState({
    databaseId: null,
  });

  const [selectedDataset, setSelectedDataset] = useState(null);

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
              }
            });
          },
        },
      ],
    });
  };

  const handleSelectDataset = item => {
    console.log('handleSelectDataset', item);
    if (setDataSet) setDataSet(item);
    setSelectedDataset(item);
  };

  const handleDeleteDataset = item => {
    console.log('handleDeleteDataset', item);
    alert.success(`${item.title} 데이터셋를 삭제하시겠습니까?`, {
      title: '데이터베이스 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => {
            DatasetService.deleteDataset(item.id).then(response => {
              getDatabaseInfo();
            });
          },
        },
      ],
    });
  };

  return (
    <Box>
      <Grid container spacing={5}>
        <Grid item xs={12} md={4}>
          <TitleBox title="데이터 소스" button={<AddIconButton link="source/create" />}>
            <DatabaseCardList
              data={databaseList}
              selectedDatabase={selectedDatabase}
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
                <DatasetCardList
                  data={datasetList}
                  selectedDataset={selectedDataset}
                  onSelectDataset={handleSelectDataset}
                  onDeleteDataset={handleDeleteDataset}
                  disabledIcons={!!isViewMode}
                />
              </TitleBox>
            </Grid>
            <Grid item xs={12}>
              <TitleBox title="데이터 목록">
                <DatasetCardList
                  data={tableList}
                  selectedDataset={selectedDataset}
                  onSelectDataset={handleSelectDataset}
                  disabledIcons={true}
                />
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
