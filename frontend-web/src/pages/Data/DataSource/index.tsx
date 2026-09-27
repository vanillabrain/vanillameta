import { useContext, useEffect, useLayoutEffect, useState } from 'react';
import { Stack, Typography } from '@mui/material';
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
import OracleDatabaseForm from '@/pages/Data/DataSource/form/OracleDatabaseForm';
import { useIsFetching, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

function DataSource() {
  const { sourceId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const alert = useAlert();
  const snackbar = useAlert(SnackbarContext);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const queryClient = useQueryClient();

  const [isModifyMode, setIsModifyMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [dataType, setDataType] = useState(null);
  const [typeList, setTypeList] = useState([]);
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
      filename: '',
    },
    bigquery: {
      projectId: '',
      filename: '',
      database: '',
    },
    oracle: {
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
      account: '',
      username: '',
      password: '',
      database: '',
      application: '',
      schema: '',
      warehouse: '',
    },
  });

  // 데이터베이스 타입 목록 조회
  const { data: databaseTypeResponse } = useQuery({
    queryKey: ['database-types'],
    queryFn: async () => (await DatabaseService.selectDatabaseTypeList()).data,
  });

  useEffect(() => {
    if (databaseTypeResponse?.status === STATUS.SUCCESS) {
      const list = databaseTypeResponse.data;
      list.forEach(item => (item.icon = getDatabaseIcon(item.type)));
      setTypeList(list);
    }
  }, [databaseTypeResponse]);

  // 수정 모드일 경우 데이터베이스 정보 조회
  const { data: databaseInfoResponse } = useQuery({
    queryKey: ['database-info-edit', sourceId],
    queryFn: async () => (await DatabaseService.selectDatabaseInfo(sourceId)).data,
    enabled: isModifyMode,
  });

  useEffect(() => {
    const info = databaseInfoResponse;
    if (info?.status !== 'SUCCESS') return;

    const databaseInfo = info.data.databaseInfo;
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
    setFormData(temp);
  }, [databaseInfoResponse]);

  // 연결 테스트
  const testMutation = useMutation({
    mutationFn: (param: any) => DatabaseService.testConnection(param),
  });

  // 데이터베이스 생성/수정
  const saveMutation = useMutation({
    mutationFn: async ({ id, param }: { id?: string; param: any }) =>
      id ? DatabaseService.updateDatabase(id, param) : DatabaseService.createDatabase(param),
  });

  const isMutating = testMutation.isPending || saveMutation.isPending;
  const fetchingCount = useIsFetching();
  useEffect(() => {
    if (fetchingCount > 0 || isMutating) {
      showLoading();
    } else {
      hideLoading();
    }
  }, [fetchingCount, isMutating]);

  useLayoutEffect(() => {
    if (pathname.indexOf('modify') > 0 && sourceId) {
      // 데이터소스 수정일 경우
      setIsModifyMode(true);
    }
  }, []);

  useEffect(() => {
    getType();
  }, [typeList, formData.type]);

  const testConnect = async item => {
    const param = {
      name: item.name,
      description: item.name,
      connectionConfig: item,
      engine: dataType.engine,
    };
    const response = await testMutation.mutateAsync(param);
    if (response.data.status === STATUS.SUCCESS) {
      setIsConnected(true);
      snackbar.success('데이터베이스 연결에 성공했습니다.');
    } else {
      snackbar.error('데이터베이스에 연결할 수 없습니다. 데이터베이스 정보를 확인해주세요');
    }
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
    const param: any = {
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
          onClick: async () => {
            const response = await saveMutation.mutateAsync({
              id: isModifyMode ? sourceId : undefined,
              param,
            });
            if (response.data.status === STATUS.SUCCESS) {
              queryClient.invalidateQueries({ queryKey: ['databases'] });
              navigate('/data');
              snackbar.success(
                `데이터베이스가 ${isModifyMode ? '수정' : '생성'}되었습니다.`,
              );
            } else {
              alert.error('데이터베이스 저장에 실패했습니다.\n다시 시도해 주세요.');
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
        return <Typography sx={{ my: '160px', mx: 'auto' }}>데이터 소스 타입을 먼저 선택해 주세요.</Typography>;
      default:
        return <DatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />;
    }
  };

  return (
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
  );
}

export default DataSource;
