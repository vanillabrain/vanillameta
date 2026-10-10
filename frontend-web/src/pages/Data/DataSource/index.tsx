import React, { useContext, useEffect, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import PageTitleBox from '@/components/PageTitleBox';
import ImgCardList from '@/components/ImgCardList';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import DatabaseService from '@/api/databaseService';
import { useQuery } from '@tanstack/react-query';
import { STATUS } from '@/constant';
import { getDatabaseIcon } from '@/widget/utils/iconUtil';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import DatabaseForm from '@/pages/Data/DataSource/form/DatabaseForm';
import SqliteDatabaseForm from '@/pages/Data/DataSource/form/SqliteDatabaseForm';
import BigQueryDatabaseForm from '@/pages/Data/DataSource/form/BigQueryDatabaseForm';
import { SnackbarContext } from '@/contexts/AlertContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import SnowflakeDatabaseForm from '@/pages/Data/DataSource/form/SnowflakeDatabaseForm';
import OracleDatabaseForm from '@/pages/Data/DataSource/form/OracleDatabaseForm';

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
  const { data: savedDatabase } = useQuery({
    queryKey: ['databaseInfo', sourceId],
    queryFn: () => DatabaseService.selectDatabaseInfo(sourceId).then(response => response.data.data.databaseInfo),
    enabled: isModifyMode,
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
    setDataType(item);
    setFormData({ type: item.type });
  };

  const handleCancelClick = () => {
    navigate('/data');
  };

  const dbType = () => {
    switch (dataType?.type) {
      case 'sqlite':
        return <SqliteDatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
      case 'bigquery':
        return <BigQueryDatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
      case 'oracle':
        return <OracleDatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
      case 'snowflake':
        return <SnowflakeDatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
      case undefined:
        return <Typography sx={{ my: '160px', mx: 'auto' }}>{t('dataSource.selectType')}</Typography>;
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
      sx={{ p: 0 }}
    >
      <Stack sx={{ width: '100%' }}>
        <Stack sx={{ p: '30px 25px 50px 25px' }}>
          <Typography
            variant="subtitle1"
            component="span"
            sx={{ fontWeight: 'bold', fontSize: '18px', color: '#141414', mb: '14px' }}
          >
            {t('dataSource.step1')}
          </Typography>
          <ImgCardList
            data={typeList}
            selectedType={dataType}
            setSelectedType={setDataType}
            handleTypeClick={handleTypeClick}
          />
        </Stack>
        <Stack sx={{ p: '30px 25px 50px 25px', bgcolor: '#f5f6f8' }}>
          <Typography
            variant="subtitle1"
            component="span"
            sx={{ fontWeight: 'bold', fontSize: '18px', color: '#141414', mb: '14px' }}
          >
            {t('dataSource.step2')}
          </Typography>
          {dbType()}
        </Stack>
      </Stack>
    </PageTitleBox>
  );
}

export default DataSource;
