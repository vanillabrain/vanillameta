import { useContext, useEffect, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import { DatabaseCardList } from '@/components/list/DatabaseCardList';
import { DatasetCardList } from '@/components/list/DatasetCardList';
import DatasetService from '@/api/datasetService';
import AddButton from '@/components/button/AddButton';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import { Loading } from '@/components/loading';
import ModalPopup from '@/components/ModalPopup';
import { createColumns } from '@/utils/util';
import DataGrid, { DataGridWrapper } from '@/components/datagrid';
import { useIsFetching, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

const buildDataParam = (selectedData: DataTableProps | DataSetProps | null) => {
  switch (selectedData?.datasetType) {
    case 'DATASET': {
      const { id, ...rest } = selectedData;
      return { ...rest, datasetId: id };
    }
    case 'TABLE':
      return { ...selectedData };
    default:
      return null;
  }
};

const DataLayout = props => {
  const { isViewMode, setDataSet } = props;
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const navigate = useNavigate();
  const { loading, showLoading, hideLoading } = useContext(LoadingContext);
  const queryClient = useQueryClient();

  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseProps>({ id: null, name: null });
  const [selectedDataset, setSelectedDataset] = useState<DataSetProps | DataTableProps | null>(null);
  const [open, setOpen] = useState(false);
  const [datasetList, setDatasetList] = useState<DataSetProps[] | []>([]);
  const [tableList, setTableList] = useState<DataTableProps[] | []>([]);
  const [gridData, setGridData] = useState<any[]>([]);
  const [gridColumns, setGridColumns] = useState<any[]>([]);

  // 진행 중인 요청이 있으면 로딩 표시
  const fetchingCount = useIsFetching();
  useEffect(() => {
    if (fetchingCount > 0) {
      showLoading();
    } else {
      hideLoading();
    }
  }, [fetchingCount]);

  // 데이터베이스 목록 조회
  const { data: databaseList = [] } = useQuery<DatabaseProps[]>({
    queryKey: ['databases'],
    queryFn: async () => (await DatabaseService.selectDatabaseList()).data.data,
  });

  useEffect(() => {
    if (!selectedDatabase.id && databaseList.length > 0) {
      setSelectedDatabase(databaseList[0]);
    }
  }, [databaseList]);

  // 선택한 데이터베이스의 데이터셋/테이블 조회
  const {
    data: databaseInfo,
    isError: isDatabaseInfoError,
    error: databaseInfoError,
  } = useQuery({
    queryKey: ['database-info', selectedDatabase.id],
    queryFn: async () => (await DatabaseService.selectDatabase(String(selectedDatabase.id))).data,
    enabled: !!selectedDatabase.id,
  });

  useEffect(() => {
    if (!databaseInfo) return;
    if (databaseInfo.status === STATUS.SUCCESS) {
      setDatasetList(databaseInfo.data.datasets);
      setTableList(databaseInfo.data.tables);
    } else {
      alert.error('데이터베이스 조회에 실패했습니다.\n다시 시도해 주세요.');
      setDatasetList([]);
      setTableList([]);
    }
  }, [databaseInfo]);

  useEffect(() => {
    if (isDatabaseInfoError) {
      snackbar.error((databaseInfoError as any)?.message);
      setDatasetList([]);
      setTableList([]);
    }
  }, [isDatabaseInfoError]);

  // 모달 그리드 데이터 조회
  const dataParam = buildDataParam(selectedDataset);
  const { data: gridResult, isError: isGridError } = useQuery({
    queryKey: ['dataset-data', selectedDataset],
    queryFn: async () => (await DatabaseService.selectData(dataParam)).data,
    enabled: open && !!dataParam,
    retry: false,
  });

  useEffect(() => {
    if (gridResult?.status === STATUS.SUCCESS) {
      setGridData(gridResult.data.datas);
      setGridColumns(createColumns(gridResult.data.datas));
    }
  }, [gridResult]);

  useEffect(() => {
    if (isGridError) {
      setGridData([]);
      setGridColumns([]);
    }
  }, [isGridError]);

  // 데이터베이스 삭제
  const deleteDatabaseMutation = useMutation({
    mutationFn: (id: string) => DatabaseService.deleteDatabase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      snackbar.success('데이터베이스가 삭제되었습니다.');
    },
  });

  // 데이터셋 삭제
  const deleteDatasetMutation = useMutation({
    mutationFn: (id: string) => DatasetService.deleteDataset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-info'] });
      snackbar.success('데이터셋이 삭제되었습니다.');
    },
  });

  const handleDatabaseClick = (item: DatabaseProps) => {
    setSelectedDatabase(item);
  };

  const handleDatabaseRemove = item => {
    alert.success(`${item.name}\n데이터베이스를 삭제하시겠습니까?`, {
      title: '데이터베이스 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => deleteDatabaseMutation.mutate(String(item.databaseId)),
        },
      ],
    });
  };

  const handleDataSetClick = (item: DataTableProps | DataSetProps) => {
    if (isViewMode) {
      setDataSet(item);
    } else {
      setOpen(true);
    }
    setSelectedDataset(item);
  };

  const handleModifyClick = (item: DataTableProps | DataSetProps) => {
    if (item?.datasetType == 'DATASET') {
      navigate(`/data/set/modify/${item.id}`);
    } else {
      navigate(`/data/set/create/${item.databaseId}`, { state: item });
    }
  };

  const handleClose = () => {
    setOpen(false);
    setGridData([]);
    setGridColumns([]);
  };

  const handleDataSetRemove = item => {
    alert.success(`${item.title}\n데이터셋을 삭제하시겠습니까?`, {
      title: '데이터베이스 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => deleteDatasetMutation.mutate(String(item.id)),
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
            데이터 소스
          </Typography>
          {isViewMode ? <></> : <AddButton component={RouterLink} to={`source/create`} sx={{ ml: '14px' }} />}
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
              데이터 셋
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
              테이블 목록
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
