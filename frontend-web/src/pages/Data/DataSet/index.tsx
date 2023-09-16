import React, { useContext, useEffect, useLayoutEffect, useState } from 'react';
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

const DataSet = () => {
  const { setId, sourceId } = useParams();
  const { pathname, state } = useLocation();
  const navigate = useNavigate();

  const { showLoading, hideLoading } = useContext(LoadingContext);

  const [isModifyMode, setIsModifyMode] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [datasetInfo, setDatasetInfo] = useState({ databaseId: sourceId, title: '', query: '' });

  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [databaseId, setDatabaseId] = useState(null);
  const [databaseList, setDatabaseList] = useState([]);
  const [tableList, setTableList] = useState([]);

  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);

  useLayoutEffect(() => {
    console.log('modify', pathname.indexOf('modify'));
    console.log('setId:', setId, 'sourceId:', sourceId);
    getDatabaseTypeList();

    if (pathname.indexOf('modify') > 0 && setId) {
      // 데이터셋 수정일 경우
      setIsModifyMode(true);
      getDatasetInfo();
    } else if (sourceId && state) {
      const { tableName } = state as any;
      setDatasetInfo(prevState => ({ ...prevState, title: tableName, query: `SELECT * FROM ${tableName}` }));
      console.log('state:', state);
      console.log('datasetInfo:', datasetInfo);
    }
  }, []);

  useEffect(() => {
    if (databaseId) getDatabaseInfo();
  }, [databaseId]);

  useEffect(() => {
    addCompleter();
  }, [tableList]);

  useEffect(() => {
    if (!databaseId) getDatabaseId();
  }, [databaseList, datasetInfo]);

  const addCompleter = () => {
    const rhymeCompleter = {
      getCompletions: (editor, session, pos, prefix, callback) => {
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
    console.log('change', newValue);
    setDatasetInfo(prevState => ({ ...prevState, query: newValue }));
  };

  const onChangeTitle = event => {
    console.log('onChangeTitle', event.target.value);
    setDatasetInfo(prevState => ({ ...prevState, title: event.target.value }));
  };

  const onChangeDatabaseId = event => {
    console.log('changeDatabaseId', event.target.value);
    setDatabaseId(event.target.value);
    setDatasetInfo(prevState => ({ ...prevState, databaseId: event.target.value }));
  };

  /**
   * 데이터베이스 타입 목록 조회
   */
  const getDatabaseTypeList = () => {
    showLoading();
    DatabaseService.selectDatabaseList()
      .then(response => {
        console.log('selectDatabaseTypeList', response.data);
        if (response.data.status === STATUS.SUCCESS) {
          const list = response.data.data;
          list.map(item => (item.icon = getDatabaseIcon(item.engine)));
          setDatabaseList(list);
        }
      })
      .finally(() => {
        hideLoading();
      });
  };

  const getDatabaseId = () => {
    if (databaseList.length > 0) {
      if (!isModifyMode) {
        setDatabaseId(sourceId);
      } else {
        setDatabaseId(datasetInfo?.databaseId);
      }
    }
  };

  const getDatabaseInfo = () => {
    showLoading();
    DatabaseService.selectDatabase(databaseId)
      .then(response => {
        if (response.data.status === 'SUCCESS') {
          setTableList(response.data.data.tables);
          console.log('tableList ', response.data.data.tables);
        } else {
          alert.error('데이터베이스 조회에 실패했습니다.\n다시 시도해 주세요.');
          setTableList([]);
        }
      })
      .catch(error => {
        snackbar.error(error.message);
        setTableList([]);
      })
      .finally(() => {
        hideLoading();
      });
  };

  /**
   * 수정일 경우 데이터셋 정보 조회
   */
  const getDatasetInfo = () => {
    showLoading();
    DatasetService.selectDataset(setId)
      .then(response => {
        console.log('selectDataset', response.data.data.id, response.data.data.databaseId);
        if (response.data.status === 'SUCCESS') {
          setDatasetInfo(response.data.data);
        } else {
          alert.error('데이터베이스 조회에 실패했습니다.\n다시 시도해 주세요.');
        }
      })
      .finally(() => {
        hideLoading();
      });
  };

  /**
   * 쿼리 실행
   */
  const excuteQuery = () => {
    showLoading();
    const param = {
      id: databaseId,
      query: datasetInfo.query,
    };
    console.log('param', param);
    DatabaseService.executeQuery(param)
      .then(response => {
        console.log(response.data);
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
      })
      .catch(error => {
        snackbar.error(error.message);
        setTestCompleted(false);
        setData([]);
        setColumns([]);
      })
      .finally(() => {
        hideLoading();
      });
  };

  const saveDataset = event => {
    event.preventDefault();
    console.log('저장', datasetInfo);

    alert.success(`데이터셋을 ${isModifyMode ? '수정' : '생성'}하시겠습니까?`, {
      closeCopy: '취소',
      actions: [
        {
          copy: '확인',
          onClick: () => {
            showLoading();
            if (isModifyMode) {
              DatasetService.updateDataset(setId, datasetInfo)
                .then(response => {
                  console.log(response.data);
                  if (response.data.status === STATUS.SUCCESS) {
                    navigate('/data');
                    snackbar.success('데이터셋이 수정되었습니다.');
                  } else {
                    alert.error('데이터셋 수정에 실패했습니다.\n다시 시도해 주세요.');
                  }
                })
                .finally(() => {
                  hideLoading();
                });
            } else {
              DatasetService.createDataset(datasetInfo)
                .then(response => {
                  console.log(response.data);
                  if (response.data.status === STATUS.SUCCESS) {
                    navigate('/data');
                    snackbar.success('데이터셋이 생성되었습니다.');
                  } else {
                    alert.error('데이터셋 생성에 실패했습니다.\n다시 시도해 주세요.');
                  }
                })
                .finally(() => {
                  hideLoading();
                });
            }
          },
        },
      ],
    });
  };

  const handleCancel = () => {
    console.log('취소');
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
          // renderValue={selected => {
          //   if (selected.length === 0) {
          //     return <Typography sx={{ color: '#929292', fontStyle: 'italic' }}>데이터베이스를 선택해 주세요.</Typography>;
          //   } else {
          //     const item = databaseList?.find(({ id: value }) => value === selected);
          //     return item?.name;
          //   }
          // }}
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
