import { useContext, useEffect, useLayoutEffect, useState } from 'react';
import { MenuItem, Select, Stack, TextField } from '@mui/material';
import { useAlert } from 'react-alert';
import PageTitleBox from '@/components/PageTitleBox';
import SubmitButton from '@/components/button/SubmitButton';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-mysql';
import 'ace-builds/src-noconflict/theme-tomorrow';
import 'ace-builds/src-noconflict/snippets/mysql';
import LangTools from 'ace-builds/src-min-noconflict/ext-language_tools';
import DataGrid from '@/components/datagrid';
import DatabaseService from '@/api/databaseService';
import DatasetService from '@/api/datasetService';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { STATUS } from '@/constant';
import { getDatabaseIcon } from '@/widget/utils/iconUtil';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import { createColumns } from '@/utils/util';
import { useIsFetching, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const DataSet = () => {
  const { setId, sourceId } = useParams();
  const { pathname, state } = useLocation();
  const navigate = useNavigate();

  const { showLoading, hideLoading } = useContext(LoadingContext);
  const queryClient = useQueryClient();

  const [isModifyMode, setIsModifyMode] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [datasetInfo, setDatasetInfo] = useState<any>({ databaseId: sourceId, title: '', query: '' });

  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [databaseId, setDatabaseId] = useState(null);
  const [databaseList, setDatabaseList] = useState([]);
  const [tableList, setTableList] = useState([]);

  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);

  // 데이터베이스(데이터소스) 목록 조회
  const { data: databaseListResponse } = useQuery({
    queryKey: ['databases'],
    queryFn: async () => (await DatabaseService.selectDatabaseList()).data,
  });

  useEffect(() => {
    if (databaseListResponse?.status === STATUS.SUCCESS) {
      const list = databaseListResponse.data;
      list.forEach(item => (item.icon = getDatabaseIcon(item.engine)));
      setDatabaseList(list);
    }
  }, [databaseListResponse]);

  // 선택한 데이터소스의 테이블 목록 조회
  const { data: databaseInfoResponse, isError: isDatabaseInfoError, error: databaseInfoError } = useQuery({
    queryKey: ['database-info', databaseId],
    queryFn: async () => (await DatabaseService.selectDatabase(String(databaseId))).data,
    enabled: !!databaseId,
  });

  useEffect(() => {
    if (!databaseInfoResponse) return;
    if (databaseInfoResponse.status === 'SUCCESS') {
      setTableList(databaseInfoResponse.data.tables);
    } else {
      alert.error('데이터베이스 조회에 실패했습니다.\n다시 시도해 주세요.');
      setTableList([]);
    }
  }, [databaseInfoResponse]);

  useEffect(() => {
    if (isDatabaseInfoError) {
      snackbar.error((databaseInfoError as any)?.message);
      setTableList([]);
    }
  }, [isDatabaseInfoError]);

  // 수정 모드일 경우 데이터셋 정보 조회
  const { data: datasetResponse } = useQuery({
    queryKey: ['dataset', setId],
    queryFn: async () => (await DatasetService.selectDataset(setId)).data,
    enabled: isModifyMode && !!setId,
  });

  useEffect(() => {
    if (datasetResponse?.status === 'SUCCESS') {
      setDatasetInfo(datasetResponse.data);
    } else if (datasetResponse) {
      alert.error('데이터베이스 조회에 실패했습니다.\n다시 시도해 주세요.');
    }
  }, [datasetResponse]);

  // 쿼리 실행
  const executeMutation = useMutation({
    mutationFn: (param: any) => DatabaseService.executeQuery(param),
  });

  // 데이터셋 생성/수정
  const saveMutation = useMutation({
    mutationFn: async ({ id, param }: { id?: string; param: any }) =>
      id ? DatasetService.updateDataset(id, param) : DatasetService.createDataset(param),
  });

  const isMutating = executeMutation.isPending || saveMutation.isPending;
  const fetchingCount = useIsFetching();
  useEffect(() => {
    if (fetchingCount > 0 || isMutating) {
      showLoading();
    } else {
      hideLoading();
    }
  }, [fetchingCount, isMutating]);

  useLayoutEffect(() => {
    if (pathname.indexOf('modify') > 0 && setId) {
      // 데이터셋 수정일 경우
      setIsModifyMode(true);
    } else if (sourceId && state) {
      const { tableName } = state as any;
      setDatasetInfo((prevState: any) => ({ ...prevState, title: tableName, query: `SELECT * FROM ${tableName}` }));
    }
  }, []);

  useEffect(() => {
    if (databaseId) return;
    if (databaseList.length === 0) return;
    if (!isModifyMode) {
      setDatabaseId(sourceId);
    } else {
      setDatabaseId(datasetInfo?.databaseId);
    }
  }, [databaseList, datasetInfo]);

  useEffect(() => {
    addCompleter();
  }, [tableList]);

  const addCompleter = () => {
    const rhymeCompleter = {
      getCompletions: (_editor, _session, _pos, prefix, callback) => {
        if (prefix.length === 0) {
          callback(null, []);
          return;
        }
        callback(
          null,
          tableList.map(item => {
            return {
              name: item.tableName,
              value: item.tableName,
              meta: 'table',
            };
          }),
        );
      },
    };
    LangTools.addCompleter(rhymeCompleter);
  };

  const onChange = newValue => {
    setDatasetInfo(prevState => ({ ...prevState, query: newValue }));
  };

  const onChangeTitle = event => {
    setDatasetInfo(prevState => ({ ...prevState, title: event.target.value }));
  };

  const onChangeDatabaseId = event => {
    setDatabaseId(event.target.value);
    setDatasetInfo(prevState => ({ ...prevState, databaseId: event.target.value }));
  };

  /**
   * 쿼리 실행
   */
  const excuteQuery = async () => {
    const param = {
      id: databaseId,
      query: datasetInfo.query,
    };
    const response = await executeMutation.mutateAsync(param);
    if (response.data.status === 'SUCCESS') {
      setTestCompleted(true);
      setData(response.data.datas);
      setColumns(createColumns(response.data.datas));
      snackbar.success('Success!');
    } else {
      setTestCompleted(false);
      setData([]);
      setColumns([]);
      snackbar.error(`${response.data.message}`);
    }
  };

  const saveDataset = event => {
    event.preventDefault();

    alert.success(`데이터셋을 ${isModifyMode ? '수정' : '생성'}하시겠습니까?`, {
      closeCopy: '취소',
      actions: [
        {
          copy: '확인',
          onClick: async () => {
            const response = await saveMutation.mutateAsync({
              id: isModifyMode ? setId : undefined,
              param: datasetInfo,
            });
            if (response.data.status === STATUS.SUCCESS) {
              queryClient.invalidateQueries({ queryKey: ['database-info'] });
              navigate('/data');
              snackbar.success(`데이터셋이 ${isModifyMode ? '수정' : '생성'}되었습니다.`);
            } else {
              alert.error(
                `데이터셋 ${isModifyMode ? '수정' : '생성'}에 실패했습니다.\n다시 시도해 주세요.`,
              );
            }
          },
        },
      ],
    });
  };

  const handleCancel = () => {
    navigate('/data');
  };

  return (
    <PageTitleBox
      upperTitle="데이터"
      upperTitleLink="/data"
      title={`데이터셋 ${isModifyMode ? '수정' : '생성'}`}
      sx={{ p: 0 }}
      button={
        <Stack>
          <ConfirmCancelButton
            cancelLabel="이전"
            cancelProps={{
              onClick: handleCancel,
            }}
            confirmLabel="저장"
            confirmProps={{
              disabled: !testCompleted,
              form: 'datasetForm',
              type: 'submit',
              variant: 'contained',
            }}
          />
        </Stack>
      }
    >
      <Stack
        id="datasetForm"
        component="form"
        flexDirection="column"
        spacing="20px"
        sx={{ p: '30px 25px 40px 25px' }}
        onSubmit={saveDataset}
      >
        <Select
          id="databaseId"
          sx={{ maxWidth: '500px' }}
          displayEmpty
          disabled={isModifyMode || !databaseList.length}
          size="small"
          value={databaseId ?? ''}
          onChange={onChangeDatabaseId}
        >
          {databaseList.length ? (
            databaseList.map(item => (
              <MenuItem key={item.id} value={item.id ?? ''}>
                {item.name}
              </MenuItem>
            ))
          ) : (
            <MenuItem value="">불러올 데이터 소스가 없습니다.</MenuItem>
          )}
        </Select>

        <TextField
          id="userSetName"
          label="데이터셋 이름"
          placeholder="데이터셋의 이름을 입력해 주세요"
          value={datasetInfo?.title}
          onChange={onChangeTitle}
          required
        />
        <AceEditor
          placeholder="Please enter a query."
          style={{ width: '100%', height: '200px', border: 'solid 1px #ddd' }}
          mode="mysql"
          theme="tomorrow"
          name="codeInput"
          onChange={onChange}
          fontSize={14}
          showPrintMargin={true}
          showGutter={true}
          highlightActiveLine={true}
          value={datasetInfo.query}
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
            showLineNumbers: true,
            tabSize: 2,
          }}
        />
        <SubmitButton
          label="Run"
          type="button"
          size="large"
          sx={{ width: '374px', fontSize: '13px' }}
          onClick={excuteQuery}
        />
      </Stack>
      {data.length ? (
        <Stack sx={{ p: '30px 25px 40px 25px', backgroundColor: '#f5f6f8' }}>
          <DataGrid
            minBodyHeight={300}
            bodyHeight={500}
            data={data}
            columns={columns}
            columnOptions={{
              resizable: true,
            }}
          />
        </Stack>
      ) : (
        ''
      )}
    </PageTitleBox>
  );
};

export default DataSet;
