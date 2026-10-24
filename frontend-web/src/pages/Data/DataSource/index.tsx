import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';

import PageTitleBox from '@/components/PageTitleBox';
import ImgCardList from '@/components/ImgCardList';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { getDatabaseIcon } from '@/widget/utils/iconUtil';
import DatabaseForm from '@/pages/Data/DataSource/form/DatabaseForm';
import BigQueryDatabaseForm from '@/pages/Data/DataSource/form/BigQueryDatabaseForm';
import { SnackbarContext } from '@/contexts/AlertContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import SnowflakeDatabaseForm from '@/pages/Data/DataSource/form/SnowflakeDatabaseForm';
import OracleDatabaseForm from '@/pages/Data/DataSource/form/OracleDatabaseForm';

const stepTitleClassName = 'mb-4 block text-base font-semibold text-foreground sm:text-lg';

const buildFormData = databaseInfo => {
  const temp: any = {
    name: databaseInfo.name,
    type: databaseInfo.type,
  };
  if (databaseInfo.type === 'sqlite') {
    temp.sqlite = { filename: databaseInfo.connectionConfig.filename };
  } else if (databaseInfo.type === 'bigquery') {
    temp.bigquery = {
      projectId: databaseInfo.connectionConfig.projectId,
      keyFilename: databaseInfo.connectionConfig.keyFilename,
      schema: databaseInfo.connectionConfig.schema,
    };
  } else if (databaseInfo.type === 'oracle') {
    temp.oracle = {
      host: databaseInfo.connectionConfig.host,
      port: Number(databaseInfo.connectionConfig.port),
      user: databaseInfo.connectionConfig.user,
      database: databaseInfo.connectionConfig.database,
      instanceName: databaseInfo.connectionConfig.instanceName,
      fetchAsString: databaseInfo.connectionConfig.fetchAsString,
      requestTimeout: databaseInfo.connectionConfig.requestTimeout,
    };
  } else if (databaseInfo.type === 'snowflake') {
    temp.snowflake = {
      account: databaseInfo.connectionConfig.account,
      username: databaseInfo.connectionConfig.username,
      database: databaseInfo.connectionConfig.database,
      application: databaseInfo.connectionConfig.application,
      schema: databaseInfo.connectionConfig.schema,
      warehouse: databaseInfo.connectionConfig.warehouse,
    };
  } else {
    temp.default = {
      host: databaseInfo.connectionConfig.host,
      port: Number(databaseInfo.connectionConfig.port),
      user: databaseInfo.connectionConfig.user,
      database: databaseInfo.connectionConfig.database,
    };
  }
  return temp;
};

function DataSource() {
  const { t } = useTranslation();
  const { sourceId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  const [isConnected, setIsConnected] = useState(false);
  const [dataType, setDataType] = useState(null);
  const isModifyMode = pathname.indexOf('modify') > 0 && !!sourceId;
  const { data: typeList = [] } = useQuery({
    queryKey: ['databaseTypes'],
    queryFn: () =>
      DatabaseService.selectDatabaseTypeList().then(response => {
        const list = response.data.data;
        list.map(item => (item.icon = getDatabaseIcon(item.type)));
        return list;
      }),
  });
  const { data: savedDatabase, error: sourceError } = useQuery({
    queryKey: ['databaseInfo', sourceId],
    queryFn: () => DatabaseService.selectDatabaseInfo(sourceId).then(response => response.data.data.databaseInfo),
    enabled: isModifyMode,
    retry: false,
  });
  const [formData, setFormData] = useState<any>({
    type: '',
    name: '',
    default: {
      host: '',
      port: null,
      user: '',
      password: '',
      database: '',
    },
    sqlite: {
      // name: '',
      filename: '',
    },
    bigquery: {
      // name: '',
      projectId: '',
      filename: '',
      database: '',
    },
    oracle: {
      // name: '',
      host: '',
      port: null,
      user: '',
      password: '',
      database: '',
      instanceName: '',
      fetchAsString: '',
      requestTimeout: '',
    },
    snowflake: {
      // name: '',
      account: '',
      username: '',
      password: '',
      database: '',
      application: '',
      schema: '',
      warehouse: '',
    },
  });

  /**
   * 수정일 경우 데이터베이스 정보 조회
   */
  useEffect(() => {
    getType();
  }, [typeList, formData.type]);

  useEffect(() => {
    if (savedDatabase) setFormData(buildFormData(savedDatabase));
  }, [savedDatabase]);

  const testConnect = item => {
    showLoading();
    const param = {
      name: item.name,
      description: item.name,
      connectionConfig: item,
      engine: dataType.engine,
    };
    DatabaseService.testConnection(param)
      .then(response => {
        console.log(response);
        if (response.data.status === STATUS.SUCCESS) {
          setIsConnected(true);
          snackbar.success(t('dataSource.connectOk'));
        } else {
          snackbar.error(t('dataSource.connectFail'));
        }
      })
      .catch(error => {
        setIsConnected(false);
        snackbar.error(t(error?.response?.status === 403 ? 'dataSource.typeUnavailable' : 'dataSource.connectFail'));
      })
      .finally(() => {
        hideLoading();
      });
  };

  const getType = () => {
    if (typeList.length > 0 && formData.type) {
      const type = typeList.filter(item => item.type === formData.type);
      setDataType(type[0]);
    }
  };

  const getFormComponentType = () => {
    switch (dataType.type) {
      case 'sqlite':
        return 'sqlite';
      case 'bigquery':
        return 'bigquery';
      case 'oracle':
        return 'oracle';
      case 'snowflake':
        return 'snowflake';
      default:
        return 'default';
    }
  };

  const handleSaveClick = () => {
    const param = {
      name: formData.name,
      description: formData.name,
      type: dataType.type,
      engine: dataType.engine,
      connectionConfig: formData[getFormComponentType()],
    };

    // 숫자 형변환
    if (param?.connectionConfig?.port) {
      param.connectionConfig.port = Number(param.connectionConfig.port);
    }

    alert.success(t('dataSource.saveConfirm', { mode: isModifyMode ? t('dataset.modify') : t('dataset.create') }), {
      closeCopy: t('data.cancel'),
      actions: [
        {
          copy: t('data.confirm'),
          onClick: () => {
            showLoading();
            if (isModifyMode) {
              DatabaseService.updateDatabase(sourceId, param)
                .then(response => {
                  console.log(response.data);
                  if (response.data.status === STATUS.SUCCESS) {
                    console.log('데이터베이스 저장', param);
                    navigate('/data');
                    snackbar.success(t('dataSource.modified'));
                  } else {
                    alert.error(t('dataSource.saveFailed'));
                  }
                })
                .finally(() => {
                  hideLoading();
                });
            } else {
              DatabaseService.createDatabase(param)
                .then(response => {
                  if (response.data.status === STATUS.SUCCESS) {
                    console.log('데이터베이스 저장', param);
                    navigate('/data');
                    snackbar.success(t('dataSource.created'));
                  } else {
                    alert.error(t('dataSource.saveFailed'));
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

  const handleTypeClick = item => {
    if (item.type === formData.type) return;
    setDataType(item);
    setIsConnected(false);
    setFormData({ type: item.type });
  };

  const handleCancelClick = () => {
    navigate('/data');
  };

  const fileSourceGuide = () => (
    <Notice severity="info" className="flex flex-wrap items-center gap-3">
      <span className="break-words">{t('dataSource.managedFile')}</span>
      <Button variant="ghost" size="sm" onClick={() => navigate('/data/file')}>
        {t('dataSource.uploadFile')}
      </Button>
    </Notice>
  );

  const dbType = () => {
    switch (dataType?.type) {
      case 'sqlite':
        return fileSourceGuide();
      case 'bigquery':
        return <BigQueryDatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
      case 'oracle':
        return <OracleDatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
      case 'snowflake':
        return <SnowflakeDatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
      case undefined:
        return (
          <p className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 text-sm text-muted-foreground">
            {t('dataSource.selectType')}
          </p>
        );
      default:
        return <DatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
    }
  };

  return (
    <PageTitleBox
      upperTitle={t('nav.data')}
      upperTitleLink="/data"
      title={t('dataSource.title')}
      button={
        <ConfirmCancelButton
          confirmProps={{ disabled: !isConnected, onClick: handleSaveClick }}
          cancelProps={{ onClick: handleCancelClick }}
        />
      }
      className="p-0"
    >
      {isModifyMode && sourceError ? (
        <Notice severity="error" className="m-4 flex flex-wrap items-center gap-3">
          <span className="break-words">{t('dataSource.accessUnavailable')}</span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/data')}>
            {t('data.cancel')}
          </Button>
        </Notice>
      ) : savedDatabase && ['duckdb', 'sqlite', 'sqlite3', 'better-sqlite3'].includes(savedDatabase.engine) ? (
        <div className="p-4 sm:p-6">{fileSourceGuide()}</div>
      ) : isModifyMode &&
        savedDatabase &&
        typeList.length > 0 &&
        !typeList.some(item => item.engine === savedDatabase.engine) ? (
        <Notice severity="info" className="m-4 flex flex-wrap items-center gap-3">
          <span className="break-words">{t('dataSource.typeUnavailable')}</span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/data')}>
            {t('data.cancel')}
          </Button>
        </Notice>
      ) : (
        <div className="w-full">
          <div className="px-4 py-6 sm:px-6">
            <span className={stepTitleClassName}>{t('dataSource.step1')}</span>
            <ImgCardList
              data={typeList}
              selectedType={dataType}
              setSelectedType={setDataType}
              handleTypeClick={handleTypeClick}
            />
          </div>
          <div className="border-t border-border bg-muted px-4 py-6 sm:px-6">
            <span className={stepTitleClassName}>{t('dataSource.step2')}</span>
            {dbType()}
          </div>
        </div>
      )}
    </PageTitleBox>
  );
}

export default DataSource;
