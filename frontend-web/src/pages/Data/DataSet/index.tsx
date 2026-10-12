import React, { useContext, useEffect, useState } from 'react';
import { MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
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
import AiService from '@/api/aiService';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { STATUS } from '@/constant';
import { getDatabaseIcon } from '@/widget/utils/iconUtil';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import { createColumns } from '@/utils/util';

const DataSet = () => {
  const { t } = useTranslation();
  const { setId, sourceId } = useParams();
  const { pathname, state } = useLocation();
  const navigate = useNavigate();

  const { showLoading, hideLoading } = useContext(LoadingContext);

  const isModifyMode = pathname.indexOf('modify') > 0 && !!setId;
  const [testCompleted, setTestCompleted] = useState(false);
  const [datasetInfo, setDatasetInfo] = useState({ databaseId: sourceId, title: '', query: '' });

  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [databaseId, setDatabaseId] = useState(null);
  const [tableList, setTableList] = useState([]);

  const { data: databaseList = [] } = useQuery({
    queryKey: ['databases'],
    queryFn: () =>
      DatabaseService.selectDatabaseList().then(response => {
        const list = response.data.data;
        list.map(item => (item.icon = getDatabaseIcon(item.engine)));
        return list;
      }),
  });

  const { data: savedDataset } = useQuery({
    queryKey: ['dataset', setId],
    queryFn: () => DatasetService.selectDataset(setId).then(response => response.data.data),
    enabled: isModifyMode,
  });

  const { data: databaseTables } = useQuery({
    queryKey: ['database', databaseId],
    queryFn: () => DatabaseService.selectDatabase(databaseId).then(response => response.data.data.tables),
    enabled: !!databaseId,
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);

  useEffect(() => {
    if (sourceId && state) {
      const { tableName } = state as any;
      setDatasetInfo(prevState => ({ ...prevState, title: tableName, query: `SELECT * FROM ${tableName} LIMIT 500` }));
    }
  }, []);

  useEffect(() => {
    if (savedDataset) setDatasetInfo(savedDataset);
  }, [savedDataset]);

  useEffect(() => {
    setTableList(databaseTables ?? []);
  }, [databaseTables]);

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

  const getDatabaseId = () => {
    if (databaseList.length > 0) {
      if (!isModifyMode) {
        setDatabaseId(sourceId);
      } else {
        setDatabaseId(datasetInfo?.databaseId);
      }
    }
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

    alert.success(t('dataset.createConfirm', { mode: isModifyMode ? t('dataset.modify') : t('dataset.create') }), {
      closeCopy: t('data.cancel'),
      actions: [
        {
          copy: t('data.confirm'),
          onClick: () => {
            showLoading();
            if (isModifyMode) {
              DatasetService.updateDataset(setId, datasetInfo)
                .then(response => {
                  console.log(response.data);
                  if (response.data.status === STATUS.SUCCESS) {
                    navigate('/data');
                    snackbar.success(t('dataset.modified'));
                  } else {
                    alert.error(t('dataset.modifyFailed'));
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
                    snackbar.success(t('dataset.created'));
                  } else {
                    alert.error(t('dataset.createFailed'));
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

  /**
   * AI 자연어 → SQL 생성
   */
  const generateSqlWithAi = () => {
    if (!aiPrompt.trim()) {
      alert.error(t('dataset.queryRequired'));
      return;
    }
    if (!databaseId) {
      alert.error(t('dataset.selectSource'));
      return;
    }
    setAiLoading(true);
    AiService.generateSql({ databaseId, prompt: aiPrompt })
      .then(response => {
        if (response.data.status === STATUS.SUCCESS) {
          setDatasetInfo(prevState => ({ ...prevState, query: response.data.data.sql }));
          setTestCompleted(false);
          snackbar.success(t('dataset.aiGenerated'));
        } else {
          alert.error(response.data.message || t('dataset.aiFailed'));
        }
      })
      .catch(error => {
        alert.error(error.message);
      })
      .finally(() => {
        setAiLoading(false);
      });
  };

  const handleCancel = () => {
    console.log('취소');
    navigate('/data');
  };

  return (
    <PageTitleBox
      upperTitle={t('nav.data')}
      upperTitleLink="/data"
      title={isModifyMode ? t('dataset.titleModify') : t('dataset.titleCreate')}
      sx={{ p: 0 }}
      button={
        <Stack>
          <ConfirmCancelButton
            cancelLabel={t('dataSource.prev')}
            cancelProps={{
              onClick: handleCancel,
            }}
            confirmLabel={t('dataSource.save')}
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
            <MenuItem value="">{t('dataset.noSource')}</MenuItem>
          )}
        </Select>

        <TextField
          id="userSetName"
          label={t('dataset.name')}
          placeholder={t('dataset.namePlaceholder')}
          value={datasetInfo?.title}
          onChange={onChangeTitle}
          required
        />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing="12px"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{
            p: '12px 16px',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            bgcolor: 'background.default',
            minWidth: 0,
          }}
        >
          <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
            {t('dataset.aiGen')}
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder={t('dataset.aiPlaceholder')}
            value={aiPrompt}
            onChange={event => setAiPrompt(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                generateSqlWithAi();
              }
            }}
            disabled={aiLoading}
            sx={{ backgroundColor: '#fff' }}
          />
          <SubmitButton
            label={aiLoading ? t('dataset.aiBtnLoading') : t('dataset.aiBtn')}
            type="button"
            sx={{ width: '120px', height: '40px', fontSize: '13px', flexShrink: 0 }}
            onClick={generateSqlWithAi}
            disabled={aiLoading}
          />
        </Stack>
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
          sx={{ width: '100%', maxWidth: '374px', fontSize: '13px' }}
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
