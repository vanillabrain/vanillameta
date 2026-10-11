import React, { useContext, useEffect, useRef, useState } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { useTranslation } from 'react-i18next';
import { useAlert } from 'react-alert';
import { DatabaseCardList } from '@/components/list/DatabaseCardList';
import { DatasetCardList } from '@/components/list/DatasetCardList';
import DatasetService from '@/api/datasetService';
import AddButton from '@/components/button/AddButton';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import { Loading } from '@/components/loading';
import { isCancelledError, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ModalPopup from '@/components/ModalPopup';
import { createColumns } from '@/utils/util';
import DataGrid, { DataGridWrapper } from '@/components/datagrid';

// import { cancelAllRequests } from '@/helpers/apiHelper';

export interface DatabaseProps {
  id: number | string | null;
  name: string | null;
  createdAt?: string;
  description?: string;
  engine?: string;
  timezone?: string;
  type?: string;
  updatedAt?: string;
}

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

const isCancelledRequest = error =>
  isCancelledError(error) ||
  error?.code === 'ERR_CANCELED' ||
  error?.name === 'AbortError' ||
  error?.name === 'CanceledError';

const DataLayout = props => {
  const { t } = useTranslation();
  const { isViewMode, setDataSet } = props;
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const navigate = useNavigate();
  const { loading, showLoading, hideLoading } = useContext(LoadingContext);
  const queryClient = useQueryClient();
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseProps>({ id: null, name: null });
  const [selectedDataset, setSelectedDataset] = useState<DataSetProps | DataTableProps | null>(null);
  const [open, setOpen] = useState(false);
  const [gridData, setGridData] = useState<any[]>([]);
  const [gridColumns, setGridColumns] = useState<any[]>([]);
  const previewRequest = useRef(0);

  useEffect(() => {
    return () => {
      previewRequest.current += 1;
    };
  }, []);

  /**
   * 데이터베이스 목록조회
   */
  const { data: databaseList = [], isFetching: isDatabaseListFetching } = useQuery({
    queryKey: ['databases'],
    queryFn: () => DatabaseService.selectDatabaseList().then(response => response.data.data),
    retry: false,
  });

  // 목록 로딩 후 첫 번째 데이터베이스 자동 선택
  useEffect(() => {
    if (!selectedDatabase.id && databaseList.length > 0) {
      setSelectedDatabase(databaseList[0]);
    }
  }, [databaseList]);

  /**
   * 선택된 데이터베이스의 dataset/table 목록조회
   */
  const {
    data: databaseInfo,
    isFetching: isDatabaseInfoFetching,
    isError: isDatabaseInfoError,
    error: databaseInfoError,
  } = useQuery({
    queryKey: ['database', selectedDatabase.id],
    enabled: !!selectedDatabase.id,
    queryFn: () =>
      DatabaseService.selectDatabase(selectedDatabase.id).then(response => {
        if (response.data.status !== STATUS.SUCCESS) {
          throw new Error(response.data.message || t('common.dbFetchFailed'));
        }
        return response.data.data;
      }),
    retry: false,
  });
  const datasetList: DataSetProps[] =
    !isDatabaseInfoError && Array.isArray(databaseInfo?.datasets) ? databaseInfo.datasets : [];
  const tableList: DataTableProps[] = !isDatabaseInfoError && Array.isArray(databaseInfo?.tables) ? databaseInfo.tables : [];

  useEffect(() => {
    if (!selectedDatabase.id || !isDatabaseInfoError) return;
    setGridData([]);
    setGridColumns([]);
    setSelectedDataset(null);
    if (!isCancelledRequest(databaseInfoError)) alert.error(t('common.dbFetchFailed'));
  }, [selectedDatabase.id, isDatabaseInfoError, databaseInfoError]);

  useEffect(() => {
    if (isDatabaseListFetching || isDatabaseInfoFetching) showLoading();
    else hideLoading();
  }, [isDatabaseListFetching, isDatabaseInfoFetching]);

  const deleteDatabaseMutation = useMutation({
    mutationFn: (databaseId: number) => DatabaseService.deleteDatabase(databaseId),
    onSuccess: response => {
      if (response.data.status === STATUS.SUCCESS) {
        queryClient.invalidateQueries({ queryKey: ['databases'] });
        snackbar.success(t('data.dbDeleted'));
      }
    },
  });

  const deleteDatasetMutation = useMutation({
    mutationFn: (id: number) => DatasetService.deleteDataset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database', selectedDatabase.id] });
      snackbar.success(t('data.dsDeleted'));
    },
  });

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
    previewRequest.current += 1;
    const request = previewRequest.current;
    setGridData([]);
    setGridColumns([]);
    showLoading();
    DatabaseService.selectData(param)
      .then(response => {
        if (request !== previewRequest.current) return;
        if (response.data.status === STATUS.SUCCESS) {
          setGridData(response.data.data.datas);
          setGridColumns(createColumns(response.data.data.datas));
        } else {
          throw new Error(response.data.message || t('common.dbFetchFailed'));
        }
      })
      .catch(error => {
        if (request !== previewRequest.current) return;
        setGridData([]);
        setGridColumns([]);
        if (!isCancelledRequest(error)) alert.error(t('common.dbFetchFailed'));
      })
      .finally(() => {
        hideLoading();
      });
  };

  const handleDatabaseClick = (item: DatabaseProps) => {
    if (item.id === selectedDatabase.id) return;
    previewRequest.current += 1;
    setGridData([]);
    setGridColumns([]);
    setSelectedDataset(null);
    setOpen(false);
    setSelectedDatabase(item);
  };

  const handleDatabaseRemove = item => {
    console.log('handleDatabaseRemove', item);
    alert.success(t('data.dbDeleteConfirm', { name: item.name }), {
      title: t('data.dbDeleteTitle'),
      closeCopy: t('data.cancel'),
      actions: [
        {
          copy: t('data.delete'),
          onClick: () => deleteDatabaseMutation.mutate(item.databaseId),
        },
      ],
    });
  };

  const handleDataSetClick = (item: DataTableProps | DataSetProps) => {
    console.log('selected Data', item);
    if (isViewMode) {
      setDataSet(item);
    } else {
      setOpen(true);
      getData(item);
    }
    setSelectedDataset(item);
  };

  const handleModifyClick = (item: DataTableProps | DataSetProps) => {
    console.log('selected Data', item);

    if (item?.datasetType == 'DATASET') {
      navigate(`/data/set/modify/${item.id}`);
    } else {
      navigate(`/data/set/create/${item.databaseId}`, { state: item });
    }
  };

  const handleClose = () => {
    previewRequest.current += 1;
    setOpen(false);
    setGridData([]);
    setGridColumns([]);
    // if (loading) {
    //   // 진행되고 있는 모든 요청 취소
    //   cancelAllRequests();
    // }
  };

  const handleDataSetRemove = item => {
    console.log('handleDataSetRemove', item);
    alert.success(t('data.dsDeleteConfirm', { title: item.title }), {
      title: t('data.dsDeleteTitle'),
      closeCopy: t('data.cancel'),
      actions: [
        {
          copy: t('data.delete'),
          onClick: () => deleteDatasetMutation.mutate(item.id),
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
        <Stack direction="row">
          <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold', fontSize: '16px', color: '#141414' }}>
            {t('data.source')}
          </Typography>
          {isViewMode ? (
            <></>
          ) : (
            <>
              <AddButton component={RouterLink} to={`source/create`} sx={{ ml: '14px' }} />
              <Button
                component={RouterLink}
                to={`file`}
                size="small"
                sx={{ ml: '8px', fontSize: '11px', minWidth: 0, p: '2px 8px', lineHeight: '20px' }}
              >
                {t('data.fileAnalysis')}
              </Button>
              <Button
                component={RouterLink}
                to={`metric`}
                size="small"
                sx={{ ml: '8px', fontSize: '11px', minWidth: 0, p: '2px 8px', lineHeight: '20px' }}
              >
                {t('data.metric')}
              </Button>
            </>
          )}
        </Stack>
        <DatabaseCardList
          data={databaseList}
          selectedData={selectedDatabase}
          isViewMode={isViewMode}
          handleDataClick={handleDatabaseClick}
          handleDataRemove={handleDatabaseRemove}
        />
      </Stack>

      <Stack
        direction="column"
        sx={{ flex: '1 1 auto', width: { xs: '100%', md: 'calc(100% - 404px)' }, backgroundColor: '#f5f6f8' }}
      >
        <Stack direction="column" sx={{ width: '100%', px: '24px', pt: '30px' }}>
          <Stack direction="row">
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold', fontSize: '16px', color: '#141414' }}>
              {t('data.dataset')}
            </Typography>
            {isViewMode ? (
              <></>
            ) : (
              <AddButton component={RouterLink} to={`set/create/${selectedDatabase.id}`} sx={{ ml: '14px' }} />
            )}
          </Stack>
          <DatasetCardList
            isViewMode={isViewMode}
            data={datasetList}
            selectedData={selectedDataset}
            handleDataClick={handleDataSetClick}
            handleDataRemove={handleDataSetRemove}
            handleModifyClick={handleModifyClick}
          />
        </Stack>
        <Stack direction="column" sx={{ flex: '1 1 auto', width: '100%', minHeight: '50%', px: '24px', pt: '30px' }}>
          <Stack direction="row">
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold', fontSize: '16px', color: '#141414' }}>
              {t('data.tableList')}
            </Typography>
          </Stack>
          <DatasetCardList
            isTableView
            isViewMode={isViewMode}
            data={tableList}
            selectedData={selectedDataset}
            handleDataClick={handleDataSetClick}
            handleDataRemove={handleDataSetRemove}
            handleModifyClick={handleModifyClick}
          />
          <ModalPopup
            open={open}
            handleClose={handleClose}
            title={selectedDataset && (selectedDataset?.['tableName'] || selectedDataset?.['title'])}
          >
            {loading ? (
              <Loading in={loading} style={{ position: 'static', backgroundColor: 'transparent' }} />
            ) : (
              <DataGridWrapper>
                <DataGrid
                  minBodyHeight={100}
                  bodyHeight={'fitToParent'}
                  data={gridData}
                  columns={gridColumns}
                  columnOptions={{
                    resizable: true,
                  }}
                />
              </DataGridWrapper>
            )}
          </ModalPopup>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default DataLayout;
