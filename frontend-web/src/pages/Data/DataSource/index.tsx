import React, { useContext, useEffect, useLayoutEffect, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import ImgCardList from '@/components/ImgCardList';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { getDatabaseIcon } from '@/widget/utils/iconUtil';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAlert } from 'react-alert';
import DatabaseForm from '@/pages/Data/DataSource/form/DatabaseForm';
import SqliteDatabaseForm from '@/pages/Data/DataSource/form/SqliteDatabaseForm';
import BigQueryDatabaseForm from '@/pages/Data/DataSource/form/BigQueryDatabaseForm';
import { SnackbarContext } from '@/contexts/AlertContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import SnowflakeDatabaseForm from '@/pages/Data/DataSource/form/SnowflakeDatabaseForm';

function DataSource() {
  const { sourceId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  const [isModifyMode, setIsModifyMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [dataType, setDataType] = useState(null);
  const [typeList, setTypeList] = useState([]);
  const [formData, setFormData] = useState<any>({
    type: '',
    default: {
      name: '',
      host: '',
      port: null,
      user: '',
      password: '',
      database: '',
    },
    sqlite: {
      name: '',
      filename: '',
    },
    bigquery: {
      name: '',
      projectId: '',
      filename: '',
      database: '',
    },
    snowflake: {
      name: '',
      account: '',
      username: '',
      password: '',
      database: '',
      application: '',
      schema: '',
      warehouse: '',
    },
  });

  useLayoutEffect(() => {
    getDatabaseTypeList();
    console.log('modify', pathname.indexOf('modify'));
    console.log('sourceId', sourceId);

    if (pathname.indexOf('modify') > 0 && sourceId) {
      // 데이터셋 수정일 경우
      setIsModifyMode(true);
      getDatabaseInfo();
    }
  }, []);

  /**
   * 수정일 경우 데이터베이스 정보 조회
   */
  useEffect(() => {
    getType();
  }, [typeList, formData.type]);

  const getDatabaseInfo = () => {
    DatabaseService.selectDatabase(sourceId).then(response => {
      const info = response.data;
      if (info.status === 'SUCCESS') {
        const databaseInfo = info.data.databaseInfo;
        const temp: any = {
          name: databaseInfo.name,
          type: databaseInfo.type,
        };
        if (databaseInfo.type === 'sqlite') {
          temp.sqlite = {
            filename: databaseInfo.connectionConfig.filename,
          };
        } else if (databaseInfo.type === 'bigquery') {
          temp.bigquery = {
            projectId: databaseInfo.connectionConfig.projectId,
            keyFilename: databaseInfo.connectionConfig.keyFilename,
            schema: databaseInfo.connectionConfig.schema,
          };
        } else if (databaseInfo.type === 'snowflake') {
          temp.snowflake = {
            account: databaseInfo.connectionConfig.account,
            username: databaseInfo.connectionConfig.username,
            password: databaseInfo.connectionConfig.password,
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
            password: databaseInfo.connectionConfig.password,
            database: databaseInfo.connectionConfig.database,
          };
        }
        setFormData(temp);
      }
    });
  };

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
          snackbar.success('데이터베이스 연결에 성공했습니다.');
        } else {
          snackbar.error('데이터베이스에 연결할 수 없습니다. 데이터베이스 정보를 확인해주세요');
        }
      })
      .finally(() => {
        hideLoading();
      });
  };

  const getDatabaseTypeList = () => {
    DatabaseService.selectDatabaseTypeList().then(response => {
      console.log('selectDatabaseTypeList', response.data);
      if (response.data.status === STATUS.SUCCESS) {
        const list = response.data.data;
        list.map(item => (item.icon = getDatabaseIcon(item.type)));
        setTypeList(list);
        if (list.length > 0) {
          setDataType(list[0]);
        }
      }
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

    alert.success(`데이터베이스를 ${isModifyMode ? '수정' : '생성'}하시겠습니까?`, {
      closeCopy: '취소',
      actions: [
        {
          copy: '확인',
          onClick: () => {
            if (isModifyMode) {
              DatabaseService.updateDatabase(sourceId, param).then(response => {
                console.log(response.data);
                if (response.data.status === STATUS.SUCCESS) {
                  console.log('데이터베이스 저장', param);
                  navigate('/data');
                  snackbar.success('데이터베이스가 수정되었습니다.');
                } else {
                  alert.error('데이터베이스 저장에 실패했습니다.');
                }
              });
            } else {
              DatabaseService.createDatabase(param).then(response => {
                if (response.data.status === STATUS.SUCCESS) {
                  console.log('데이터베이스 저장', param);
                  navigate('/data');
                  snackbar.success('데이터베이스가 생성되었습니다.');
                } else {
                  alert.error('데이터베이스 저장에 실패했습니다.');
                }
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
      case 'snowflake':
        return <SnowflakeDatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
      default:
        return <DatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
    }
  };

  return (
    <PageContainer>
      <PageTitleBox
        upperTitle="데이터"
        upperTitleLink="/data"
        title={'데이터 소스 연결'}
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
              step.01 타입 설정
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
              step.02 연결 정보 입력
            </Typography>
            {dbType()}
          </Stack>
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataSource;
