import React, { useEffect, useLayoutEffect, useState } from 'react';
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

function DataSource() {
  const { sourceId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const alert = useAlert();
  const [isModifyMode, setIsModifyMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [dataType, setDataType] = useState(null);
  const [typeList, setTypeList] = useState([]);
  const [formData, setFormData] = useState<any>({
    type: '', // 수정일 때 받아오는 engine
    mysql2: {
      databaseName: '',
      host: '',
      port: '',
      user: '',
      password: '',
      database: '',
    },
    sqlite3: {
      databaseName: '',
      filename: '',
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
    // 수정일 때 db 정보로 setDataType
    if (typeList && formData.type) {
      const type = typeList.filter(item => {
        return item.type === formData.type;
      });
      setDataType(type[0]);
    }
  }, [typeList, formData.type]);

  const getDatabaseInfo = () => {
    DatabaseService.selectDatabase(sourceId).then(response => {
      const info = response.data;
      if (info.status === 'SUCCESS') {
        const databaseInfo = info.data.databaseInfo;
        let temp;
        if (databaseInfo.engine === 'sqlite3') {
          temp = {
            type: databaseInfo.engine,
            sqlite3: {
              databaseName: databaseInfo.name,
              filename: databaseInfo.connectionConfig.filename,
            },
          };
          setFormData(temp);
        } else {
          temp = {
            type: databaseInfo.engine,
            mysql2: {
              databaseName: databaseInfo.name,
              host: databaseInfo.connectionConfig.host,
              port: Number(databaseInfo.connectionConfig.port),
              user: databaseInfo.connectionConfig.user,
              password: databaseInfo.connectionConfig.password,
              database: databaseInfo.connectionConfig.database,
            },
          };
          setFormData(temp);
        }
      }
    });
  };

  const testConnect = item => {
    const param = {
      // name: item.name,
      // description: item.name,
      connectionConfig: item,
      engine: dataType.engine,
    };
    DatabaseService.testConnection(param).then(response => {
      console.log(response);
      if (response.data.status === STATUS.SUCCESS) {
        setIsConnected(true);
        alert.info('데이터베이스 연결에 성공하였습니다.');
      } else {
        alert.info('데이터베이스에 연결할 수 없습니다.\n데이터 베이스 정보를 확인해주세요.');
      }
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

  const handleSaveClick = () => {
    let param;
    // console.log(formData, dataType?.engine);
    if (formData.type === 'sqlite3') {
      param = {
        name: formData.sqlite3.databaseName,
        description: formData.sqlite3.databaseName,
        connectionConfig: formData.sqlite3,
        engine: formData?.type || dataType?.engine,
      };
    } else {
      param = {
        name: formData.mysql2.databaseName,
        description: formData.mysql2.databaseName,
        connectionConfig: formData.mysql2,
        engine: formData?.type || dataType?.engine,
      };
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
                  console.log('데이터 베이스 저장', param);
                  alert.info('데이터베이스가 수정되었습니다.', {
                    onClose: () => {
                      navigate('/data');
                    },
                  });
                }
              });
            } else {
              DatabaseService.createDatabase(param).then(response => {
                if (response.data.status === STATUS.SUCCESS) {
                  alert.info('데이터베이스가 생성되었습니다.', {
                    onClose: () => {
                      navigate('/data');
                    },
                  });
                }
              });
            }
          },
        },
      ],
    });
  };

  const handleCancelClick = () => {
    navigate('/data');
  };

  return (
    <PageContainer>
      <PageTitleBox
        upperTitle="데이터"
        upperTitleLink="/data"
        title={'데이터 소스 연결'}
        button={
          <ConfirmCancelButton
            confirmProps={{ disabled: false, onClick: handleSaveClick }}
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
            <ImgCardList data={typeList} selectedType={dataType} setSelectedType={setDataType} />
          </Stack>
          <Stack sx={{ p: '30px 25px 50px 25px', bgcolor: '#f5f6f8' }}>
            <Typography
              variant="subtitle1"
              component="span"
              sx={{ fontWeight: 'bold', fontSize: '18px', color: '#141414', mb: '14px' }}
            >
              step.02 연결 정보 입력
            </Typography>
            {/*{<DatabaseForm testConnect={testConnect} formData={formData} setFormData={setFormData} />}*/}
            {dataType?.type === 'sqlite3' ? (
              <SqliteDatabaseForm testConnect={testConnect} formData={formData?.sqlite3} setFormData={setFormData} />
            ) : (
              <DatabaseForm testConnect={testConnect} formData={formData?.mysql2} setFormData={setFormData} />
            )}
          </Stack>
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataSource;
