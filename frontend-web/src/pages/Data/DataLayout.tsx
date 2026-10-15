import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAlert } from 'react-alert';
import { isCancelledError, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import DatabaseService from '@/api/databaseService';
import DatasetService from '@/api/datasetService';
import { STATUS } from '@/constant';
import { DatabaseCardList } from '@/components/list/DatabaseCardList';
import { DatasetCardList } from '@/components/list/DatasetCardList';
import { Button } from '@/components/ui/button';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import { Loading } from '@/components/loading';
import ModalPopup from '@/components/ModalPopup';
import { createColumns } from '@/utils/util';
import DataGrid, { DataGridWrapper } from '@/components/datagrid';
import { cn } from '@/lib/utils';
import IconAdd from '@/assets/images/icon/ic-add.svg?react';

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

const sectionTitleClassName = 'text-base font-bold text-[#141414]';

/** 카드 목록 헤더의 등록 이동 버튼(기존 AddButton과 같은 아이콘 버튼 규격). */
const AddLinkButton = ({ to, label, className }: { to: string; label: string; className?: string }) => (
  <Button asChild size="icon-xs" aria-label={label} className={cn('ml-3.5 min-w-0 rounded-[4px] p-0', className)}>
    <RouterLink to={to}>
      <IconAdd />
    </RouterLink>
  </Button>
);

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
    <div className="flex w-full flex-auto flex-col sm:flex-row">
      <div className="flex h-full w-full flex-col px-6 pt-7.5 md:w-[404px] md:flex-none">
        <div className="flex flex-row items-center">
          <span className={sectionTitleClassName}>{t('data.source')}</span>
          {isViewMode ? null : (
            <>
              <AddLinkButton to="source/create" label={t('data.addSource')} />
              <Button asChild size="sm" className="ml-2 h-auto min-w-0 py-0.5 px-2 text-[11px] leading-5">
                <RouterLink to="file">{t('data.fileAnalysis')}</RouterLink>
              </Button>
              <Button asChild size="sm" className="ml-2 h-auto min-w-0 py-0.5 px-2 text-[11px] leading-5">
                <RouterLink to="metric">{t('data.metric')}</RouterLink>
              </Button>
            </>
          )}
        </div>
        <DatabaseCardList
          data={databaseList}
          selectedData={selectedDatabase}
          isViewMode={isViewMode}
          handleDataClick={handleDatabaseClick}
          handleDataRemove={handleDatabaseRemove}
        />
      </div>

      <div className="flex w-full flex-auto flex-col bg-[#f5f6f8] md:w-[calc(100%-404px)]">
        <div className="flex w-full flex-col px-6 pt-7.5">
          <div className="flex flex-row items-center">
            <span className={sectionTitleClassName}>{t('data.dataset')}</span>
            {isViewMode ? null : <AddLinkButton to={`set/create/${selectedDatabase.id}`} label={t('data.addDataset')} />}
          </div>
          <DatasetCardList
            isViewMode={isViewMode}
            data={datasetList}
            selectedData={selectedDataset}
            handleDataClick={handleDataSetClick}
            handleDataRemove={handleDataSetRemove}
            handleModifyClick={handleModifyClick}
          />
        </div>
        <div className="flex min-h-[50%] w-full flex-auto flex-col px-6 pt-7.5">
          <div className="flex flex-row items-center">
            <span className={sectionTitleClassName}>{t('data.tableList')}</span>
          </div>
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
              <Loading in={loading} className="static bg-transparent" />
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
        </div>
      </div>
    </div>
  );
};

export default DataLayout;
