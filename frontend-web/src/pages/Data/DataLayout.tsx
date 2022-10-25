import React, { useContext, useEffect, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { DatabaseCardList } from '@/components/list/DatabaseCardList';
import { DatasetCardList } from '@/components/list/DatasetCardList';
import DatasetService from '@/api/datasetService';
import AddButton from '@/components/button/AddButton';
import { Link as RouterLink } from 'react-router-dom';
import { LoadingContext } from '@/contexts/LoadingContext';

const DataLayout = props => {
  const { isViewMode, setDataSet } = props;
  const [databaseList, setDatabaseList] = useState([]);
  const [datasetList, setDatasetList] = useState([]);
  const [tableList, setTableList] = useState([]);
  const alert = useAlert();
  const { showLoading, hideLoading } = useContext(LoadingContext);

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
    showLoading();
    DatabaseService.selectDatabaseList().then(response => {
      setDatabaseList(response.data.data);
      if (response.data.data.length > 0) {
        setSelectedDatabase({ databaseId: response.data.data[0].id });
      }
    });
  };

  const getDatabaseInfo = () => {
    showLoading();
    DatabaseService.selectDatabase(selectedDatabase.databaseId).then(response => {
      setDatasetList(response.data.data.datasets);
      setTableList(response.data.data.tables);
      hideLoading();
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
    <Stack sx={{ width: '100%' }} direction="row">
      <Stack sx={{ width: '404px', px: '24px', pt: '30px' }}>
        <Stack direction="row" sx={{ mb: '12px' }}>
          <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold', fontSize: '16px', color: '#141414' }}>
            데이터 소스
          </Typography>
          {isViewMode ? <></> : <AddButton component={RouterLink} to={`source/create`} sx={{ ml: '14px' }} />}
        </Stack>
        <DatabaseCardList
          data={databaseList}
          selectedDatabase={selectedDatabase}
          disabledIcons={!!isViewMode}
          onUpdate={handleSelectDatabase}
          onRemove={removeDatabase}
          minWidth="100%"
        />
      </Stack>

      <Stack sx={{ width: 'calc(100% - 404px)', backgroundColor: '#f5f6f8' }}>
        <Stack sx={{ width: '100%', px: '24px', pt: '30px' }}>
          <Stack direction="row" sx={{ mb: '12px' }}>
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold', fontSize: '16px', color: '#141414' }}>
              데이터 셋
            </Typography>
            {isViewMode ? (
              <></>
            ) : (
              <AddButton component={RouterLink} to={`set/create/${selectedDatabase.databaseId}`} sx={{ ml: '14px' }} />
            )}
          </Stack>
          {datasetList.length > 0 ? (
            <DatasetCardList
              data={datasetList}
              selectedDataset={selectedDataset}
              onSelectDataset={handleSelectDataset}
              onDeleteDataset={handleDeleteDataset}
              disabledIcons={!!isViewMode}
            />
          ) : (
            <Box sx={{ height: '100px' }} />
          )}
        </Stack>
        <Stack sx={{ width: '100%', px: '24px', pt: '30px' }}>
          <Stack direction="row" sx={{ mb: '12px' }}>
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold', fontSize: '16px', color: '#141414' }}>
              테이블 목록
            </Typography>
          </Stack>
          <DatasetCardList
            data={tableList}
            selectedDataset={selectedDataset}
            onSelectDataset={handleSelectDataset}
            disabledIcons={true}
          />
        </Stack>
      </Stack>
    </Stack>
  );
};

DataLayout.defaultProps = {
  data: {},
  naviUrl: {},
};

export default DataLayout;
