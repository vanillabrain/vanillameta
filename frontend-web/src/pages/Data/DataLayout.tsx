import React, { useContext, useEffect, useState } from 'react';
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
  title?: string;
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

const DataLayout = props => {
  const { isViewMode, setDataSet } = props;
  const [databaseList, setDatabaseList] = useState<DatabaseProps[] | []>([]);
  const [datasetList, setDatasetList] = useState<DataSetProps[] | []>([]);
  const [tableList, setTableList] = useState<DataTableProps[] | []>([]);
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const navigate = useNavigate();
  const { loading, showLoading, hideLoading } = useContext(LoadingContext);
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseProps>({ id: null, name: null });
  const [selectedDataset, setSelectedDataset] = useState<DataSetProps | DataTableProps | null>(null);
  const [open, setOpen] = useState(false);
  const [gridData, setGridData] = useState<any[]>([]);
  const [gridColumns, setGridColumns] = useState<any[]>([]);

  useEffect(() => {
    getDatabaseList();
  }, []);

  useEffect(() => {
    if (selectedDatabase.id) {
      getDatabaseInfo(selectedDatabase.id);
    }
  }, [selectedDatabase.id]);

  /**
   * 데이터베이스 목록조회
   */
  const getDatabaseList = () => {
    showLoading();
    DatabaseService.selectDatabaseList()
      .then(response => {
        const resData = response.data || [];
        setDatabaseList(resData);
        if (resData.length > 0) {
          const [firstItem] = resData;
          setSelectedDatabase(firstItem);
        }
      })
      .catch(error => {
        console.error('Database list error:', error);
        setDatabaseList([]);
        snackbar.error('데이터베이스 목록을 불러오는데 실패했습니다.');
      })
      .finally(() => {
        hideLoading();
      });
  };

  const getDatabaseInfo = databaseId => {
    showLoading();
    console.log('Getting database info for databaseId:', databaseId);
    DatabaseService.selectDatabase(databaseId)
      .then(response => {
        console.log('selectDatabase response:', response);
        if (response.status === STATUS.SUCCESS && response.data) {
          // 백엔드 응답 구조에 맞게 데이터 추출
          const { datasets = [], tables = [] } = response.data;
          setDatasetList(datasets);
          setTableList(tables);
        } else {
          alert.error('데이터베이스 조회에 실패했습니다.\n다시 시도해 주세요.');
          setDatasetList([]);
          setTableList([]);
        }
      })
      .catch(error => {
        console.error('Database select error:', error);
        if (error.response?.status === 403) {
          snackbar.error('데이터베이스 접근 권한이 없습니다. 다시 로그인해주세요.');
        } else {
          snackbar.error(error.message || '데이터베이스 조회에 실패했습니다.');
        }
        setDatasetList([]);
        setTableList([]);
      })
      .finally(() => {
        hideLoading();
      });
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
        console.log('selectData response:', response);
        if (response.status === STATUS.SUCCESS) {
          // result 안에 rows가 있는 경우와 datas가 직접 있는 경우 모두 처리
          const resultData = response.data?.result || response.data;
          const rows = (resultData as any)?.rows || (resultData as any)?.datas || [];
          setGridData(rows);
          setGridColumns(createColumns(rows));
        }
      })
      .catch(error => {
        console.log('error', error);
        setGridData([]);
        setGridColumns([]);
      })
      .finally(() => {
        hideLoading();
      });
  };

  const handleDatabaseClick = (item: DatabaseProps) => {
    setSelectedDatabase(item);
  };

  const handleDatabaseRemove = item => {
    console.log('handleDatabaseRemove', item);
    alert.success(`${item.name}\n데이터베이스를 삭제하시겠습니까?`, {
      title: '데이터베이스 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => {
            DatabaseService.deleteDatabase(item.databaseId).then(response => {
              if (response.status === STATUS.SUCCESS) {
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
    alert.success(`${item.title}\n데이터셋을 삭제하시겠습니까?`, {
      title: '데이터베이스 삭제',
      closeCopy: '취소',
      actions: [
        {
          copy: '삭제',
          onClick: () => {
            DatasetService.deleteDataset(item.id).then(() => {
              getDatabaseInfo(item.id);
              snackbar.success('데이터셋이 삭제되었습니다.');
            });
          },
        },
      ],
    });
  };

  return (
    <div className="flex flex-col sm:flex-row flex-auto w-full">
      <div className="flex flex-col flex-auto w-full md:w-[404px] h-full px-6 pt-[30px]">
        <div className="flex flex-row">
          <span className="font-bold text-base text-[#141414]">데이터 소스</span>
          {isViewMode ? <></> : <AddButton component={RouterLink} to={`source/create`} className="ml-[14px]" />}
        </div>
        <DatabaseCardList
          data={databaseList}
          selectedData={selectedDatabase}
          isViewMode={isViewMode}
          handleDataClick={handleDatabaseClick}
          handleDataRemove={handleDatabaseRemove}
        />
      </div>

      <div className="flex flex-col flex-auto w-full md:w-[calc(100%-404px)] bg-[#f5f6f8]">
        <div className="flex flex-col w-full px-6 pt-[30px]">
          <div className="flex flex-row">
            <span className="font-bold text-base text-[#141414]">데이터 셋</span>
            {isViewMode ? (
              <></>
            ) : (
              <AddButton component={RouterLink} to={`set/create/${selectedDatabase.id}`} className="ml-[14px]" />
            )}
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
        <div className="flex flex-col flex-auto w-full min-h-[50%] px-6 pt-[30px]">
          <div className="flex flex-row">
            <span className="font-bold text-base text-[#141414]">테이블 목록</span>
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
        </div>
      </div>
    </div>
  );
};

export default DataLayout;
