import React, { useContext, useEffect, useRef, useState } from 'react';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-mysql';
import 'ace-builds/src-noconflict/theme-tomorrow';
import 'ace-builds/src-noconflict/snippets/mysql';
import LangTools from 'ace-builds/src-min-noconflict/ext-language_tools';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import PageTitleBox from '@/components/PageTitleBox';
import SubmitButton from '@/components/button/SubmitButton';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import DataGrid from '@/components/datagrid';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import DatabaseService from '@/api/databaseService';
import DatasetService from '@/api/datasetService';
import AiService from '@/api/aiService';
import { STATUS } from '@/constant';
import { getDatabaseIcon } from '@/widget/utils/iconUtil';
import { LoadingContext } from '@/contexts/LoadingContext';
import { SnackbarContext } from '@/contexts/AlertContext';
import { createColumns } from '@/utils/util';

/** Radix select items only carry string values; keep the empty choice addressable. */
const NO_SOURCE_VALUE = '__none__';

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
  const runButton = useRef<HTMLButtonElement>(null);
  const queryInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    queryInput.current?.setAttribute('aria-label', t('dataset.sqlQuery'));
  }, [t]);

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

  // Radix Select는 문자열 값만 다루므로 선택된 옵션의 원래 값(id)을 되돌려 숫자 계약을 유지한다.
  const databaseOptions = databaseList.length
    ? databaseList.map(item => ({ value: item.id, label: item.name }))
    : [{ value: '', label: t('dataset.noSource') }];
  const optionValue = option =>
    option.value === '' || option.value === undefined || option.value === null ? NO_SOURCE_VALUE : String(option.value);
  const selectedSourceValue =
    databaseId === '' || databaseId === undefined || databaseId === null ? NO_SOURCE_VALUE : String(databaseId);
  const handleSourceValueChange = next => {
    const matched = databaseOptions.find(option => optionValue(option) === next);
    onChangeDatabaseId({ target: { value: next === NO_SOURCE_VALUE ? '' : matched ? matched.value : '' } });
  };

  return (
    <PageTitleBox
      upperTitle={t('nav.data')}
      upperTitleLink="/data"
      title={isModifyMode ? t('dataset.titleModify') : t('dataset.titleCreate')}
      className="p-0"
      button={
        <div className="flex flex-col">
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
              variant: 'default',
            }}
          />
        </div>
      }
    >
      <form id="datasetForm" className="flex flex-col gap-5 px-6.25 pt-7.5 pb-10" onSubmit={saveDataset}>
        <Select
          value={selectedSourceValue}
          onValueChange={handleSourceValueChange}
          disabled={isModifyMode || !databaseList.length}
        >
          <SelectTrigger id="databaseId" aria-label={t('data.source')} className="w-full max-w-[500px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {databaseOptions.map(option => (
              <SelectItem key={optionValue(option)} value={optionValue(option)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TextField
          id="userSetName"
          label={t('dataset.name')}
          placeholder={t('dataset.namePlaceholder')}
          value={datasetInfo?.title}
          onChange={onChangeTitle}
          required
        />
        <div className="flex min-w-0 flex-col items-stretch gap-3 rounded-lg border border-border bg-muted p-3 sm:flex-row sm:items-center">
          <span className="shrink-0 text-sm font-semibold whitespace-nowrap">{t('dataset.aiGen')}</span>
          <TextField
            inputProps={{ 'aria-label': t('dataset.aiGen'), className: 'bg-white' }}
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
          />
          <SubmitButton
            label={aiLoading ? t('dataset.aiBtnLoading') : t('dataset.aiBtn')}
            type="button"
            className="h-10 w-[120px] shrink-0 text-[13px]"
            onClick={generateSqlWithAi}
            disabled={aiLoading}
          />
        </div>
        <div
          onKeyDownCapture={event => {
            if (event.key === 'Escape' && (event.target as HTMLElement).classList.contains('ace_text-input')) {
              event.preventDefault();
              event.stopPropagation();
              runButton.current?.focus();
            }
          }}
        >
          <div className="overflow-hidden rounded-lg border border-[#dddddd]">
            <AceEditor
              placeholder="Please enter a query."
              width="100%"
              height="200px"
              mode="mysql"
              theme="tomorrow"
              name="codeInput"
              onLoad={editor => {
                const input = editor.container.querySelector<HTMLTextAreaElement>('.ace_text-input');
                queryInput.current = input;
                input?.setAttribute('aria-label', t('dataset.sqlQuery'));
                input?.setAttribute('aria-describedby', 'sql-keyboard-help');
              }}
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
          </div>
          <span id="sql-keyboard-help" className="mt-1 block text-xs text-muted-foreground">
            {t('dataset.sqlKeyboardHelp')}
          </span>
        </div>
        <Button ref={runButton} type="button" className="w-full max-w-[374px] text-[13px]" onClick={excuteQuery}>
          Run
        </Button>
      </form>
      {data.length ? (
        <div className="bg-[#f5f6f8] px-6.25 pt-7.5 pb-10">
          <DataGrid
            minBodyHeight={300}
            bodyHeight={500}
            data={data}
            columns={columns}
            columnOptions={{
              resizable: true,
            }}
          />
        </div>
      ) : (
        ''
      )}
    </PageTitleBox>
  );
};

export default DataSet;
