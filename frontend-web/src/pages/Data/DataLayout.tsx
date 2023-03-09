import React, { useContext, useEffect, useState } from 'react';
import { Box, IconButton, Modal, Paper, Stack, Typography } from '@mui/material';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { DatabaseCardList } from '@/components/list/DatabaseCardList';
import { DatasetCardList } from '@/components/list/DatasetCardList';
import DatasetService from '@/api/datasetService';
import AddButton from '@/components/button/AddButton';
import { Link as RouterLink } from 'react-router-dom';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import { ReactComponent as CloseIcon } from '@/assets/images/icon/ic-xmark.svg';
import TableBoard from '@/widget/modules/board/TableBoard';
import { Loading } from '@/components/loading';

export interface DataSetProps {
  id: number;
  databaseId: number;
  datasetType: 'DATASET';
  title: string;
  query: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataTableProps {
  id: string;
  tableName: string;
  databaseId: number;
  datasetType: 'TABLE';
}

interface GridDataProps {
  option?: {
    columns: {
      name: string;
      header?: string;
      align?: string;
      sortable?: boolean;
    }[];
  };
  dataSet?: [];
}

const DataLayout = props => {
  const { isViewMode, setDataSet } = props;
  const [databaseList, setDatabaseList] = useState([]);
  const [datasetList, setDatasetList] = useState<DataSetProps[]>([]);
  const [tableList, setTableList] = useState<DataTableProps[]>([]);
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { loading, showLoading, hideLoading } = useContext(LoadingContext);
  const [selectedDatabase, setSelectedDatabase] = useState({ databaseId: null });
  const [selectedDataset, setSelectedDataset] = useState<DataSetProps | DataTableProps | null>(null);
  const [open, setOpen] = useState(false);
  const [gridData, setGridData] = useState<GridDataProps | null>(null);

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
    DatabaseService.selectDatabaseList()
      .then(response => {
        setDatabaseList(response.data.data);
        if (response.data.data.length > 0) {
          setSelectedDatabase({ databaseId: response.data.data[0].id });
        }
      })
      .finally(() => {
        hideLoading();
      });
  };

  const getDatabaseInfo = () => {
    showLoading();
    DatabaseService.selectDatabase(selectedDatabase.databaseId)
      .then(response => {
        if (response.data.status === 'SUCCESS') {
          setDatasetList(response.data.data.datasets);
          setTableList(response.data.data.tables);
        } else {
          alert.error('데이터베이스 조회에 실패했습니다.\n다시 시도해 주세요.');
          setDatasetList([]);
          setTableList([]);
        }
      })
      .catch(error => {
        snackbar.error(error.message);
        setDatasetList([]);
        setTableList([]);
      })
      .finally(() => {
        hideLoading();
      });
  };

  const createDataGrid = data => {
    if (data) {
      const { datas, fields } = data;
      const option = fields.map(item => ({ name: item.columnName, sortable: true }));
      setGridData({ ...gridData, dataSet: datas, option: { columns: option } });
    }
  };

  const getData = selectedData => {
    let param;
    switch (selectedData?.datasetType) {
      case 'DATASET':
        const { id, ...rest } = selectedData;
        param = { ...rest, datasetId: id };
        break;
      case 'TABLE':
        param = { ...selectedData };
        break;
      default:
        return;
    }
    showLoading();
    DatabaseService.selectData(param)
      .then(response => {
        if (response.data.status === STATUS.SUCCESS) {
          createDataGrid(response.data.data);
        }
      })
      .catch(error => {
        console.log('error', error);
        setGridData(null);
      })
      .finally(() => {
        hideLoading();
      });
  };

  const handleSelectDatabase = enteredData => {
    return setSelectedDatabase(prevState => ({ ...prevState, ...enteredData }));
  };

  const handleDatabaseRemove = (id, name) => {
    console.log('handleDatabaseRemove', id);
    alert.success(`${name}\n데이터베이스를 삭제하시겠습니까?`, {
      title: '데이터베이스 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => {
            DatabaseService.deleteDatabase(id).then(response => {
              if (response.data.status === STATUS.SUCCESS) {
                getDatabaseList();
                snackbar.success('데이터베이스가 삭제되었습니다.');
              }
            });
          },
        },
      ],
    });
  };

  const handleDataSetClick = (item: DataTableProps | DataSetProps) => {
    console.log('selected Data', item);
    if (setDataSet) {
      setDataSet(item);
    } else {
      setOpen(true);
      getData(item);
    }
    setSelectedDataset(item);
  };

  const handleClose = () => {
    setOpen(false);
    setGridData(null);
  };

  const handleDataSetRemove = item => {
    console.log('handleDataSetRemove', item);
    alert.success(`${item.title}\n데이터셋을 삭제하시겠습니까?`, {
      title: '데이터베이스 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => {
            DatasetService.deleteDataset(item.id).then(() => {
              getDatabaseInfo();
              snackbar.success('데이터셋이 삭제되었습니다.');
            });
          },
        },
      ],
    });
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} flex="1 1 auto" sx={{ width: '100%' }}>
      <Stack
        direction="column"
        flex="1 1 auto"
        sx={{ width: { xs: '100%', md: '404px' }, height: '100%', px: '24px', pt: '30px' }}
      >
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
          onRemove={handleDatabaseRemove}
          minWidth="100%"
        />
      </Stack>

      <Stack
        direction="column"
        sx={{
          flex: '1 1 auto',
          width: { xs: '100%', md: 'calc(100% - 404px)' },
          backgroundColor: '#f5f6f8',
        }}
      >
        <Stack direction="column" sx={{ width: '100%', px: '24px', pt: '30px' }}>
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
          <DatasetCardList
            data={datasetList}
            selectedDataset={selectedDataset}
            handleDataSetClick={handleDataSetClick}
            handleDataSetRemove={handleDataSetRemove}
          />
        </Stack>
        <Stack direction="column" sx={{ flex: '1 1 auto', width: '100%', minHeight: '50%', px: '24px', pt: '30px' }}>
          <Stack direction="row" sx={{ mb: '12px' }}>
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold', fontSize: '16px', color: '#141414' }}>
              테이블 목록
            </Typography>
          </Stack>
          <DatasetCardList
            sx={{ flex: '1 1 auto' }}
            data={tableList}
            selectedDataset={selectedDataset}
            handleDataSetClick={handleDataSetClick}
          />
          <Modal
            open={open}
            onClose={handleClose}
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            BackdropProps={{
              sx: {
                boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)',
                backgroundColor: 'rgba(122, 130, 144, 0.45)',
              },
            }}
          >
            <Paper
              sx={{
                display: 'flex',
                flexDirection: 'column',
                width: '80%',
                maxWidth: '1392px',
                height: '70%',
                maxHeight: '754px',
                borderRadius: '8px',
                boxShadow: '5px 5px 8px 0 rgba(0, 28, 71, 0.15)',
                border: 'solid 1px #ddd',
                p: '10px',
                pt: 0,
                backgroundColor: '#fff',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" m="15px" mr="0">
                <Typography sx={{ fontSize: '20px', fontWeight: 600, color: '#141414' }}>
                  {selectedDataset && (selectedDataset?.['tableName'] || selectedDataset?.['title'])}
                </Typography>
                <IconButton onClick={handleClose} sx={{ p: '16px' }}>
                  <CloseIcon width="16" height="16" />
                </IconButton>
              </Stack>
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flex: 1,
                }}
              >
                {loading ? (
                  <Loading in={loading} style={{ position: 'static', backgroundColor: 'transparent' }} />
                ) : (
                  <TableBoard option={gridData?.option} dataSet={gridData?.dataSet} />
                )}
              </Box>
            </Paper>
          </Modal>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default DataLayout;
