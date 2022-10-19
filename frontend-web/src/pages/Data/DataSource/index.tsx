import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Stack } from '@mui/material';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import TitleBox from '@/components/TitleBox';
import ImgCardList from '@/components/ImgCardList';
import LabelInputForm from '@/components/form/LabelInputForm';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import DatabaseService from '@/api/databaseService';
import { STATUS } from '@/constant';
import { getDatabaseIcon } from '@/widget/utils/iconUtil';
import { useNavigate } from 'react-router-dom';
import { useAlert } from 'react-alert';

// const typeList = [
//   { id: '0', title: 'MySQL', icon: 'logo/mysql-logo.svg' },
//   { id: '1', title: 'MariaDB', icon: 'logo/mariadb-logo.svg' },
//   { id: '2', title: 'PostgreSQL', icon: 'logo/pgsql-logo.svg' },
//   { id: '3', title: 'Oracle', icon: 'logo/oracle-logo.svg' },
//   { id: '4', title: 'Db2', icon: 'logo/db2-logo.svg' },
//   { id: '5', title: 'Redshift', icon: 'logo/redshift-logo.svg' },
//   { id: '6', title: 'BigQuery', icon: 'logo/bigquery-logo.svg' },
//   { id: '7', title: 'SQLite', icon: 'logo/sqlite-logo.svg' },
//   { id: '8', title: 'MSSQL', icon: 'logo/mssql-logo.svg' },
//   { id: '9', title: 'AltiBase', icon: 'logo/altibase-logo.png' },
// ];

const mysqlForm = [
  { id: '0', label: '이름', name: 'databaseName' },
  { id: '1', label: 'HOST', name: 'host', width: '50%' },
  { id: '2', label: 'Port', name: 'port', width: '50%' },
  { id: '3', label: 'User', name: 'user' },
  { id: '4', label: 'Password', name: 'password', type: 'password' },
  { id: '5', label: 'Schema', name: 'schema' },
];

function DataSource() {
  const [isConnected, setIsConnected] = useState(false);
  const [dataType, setDataType] = useState(null);
  const [typeList, setTypeList] = useState([]);
  const [databaseForm, setDatabaseForm] = useState([]);
  const [formData, setFormData] = useState(null);
  const navigate = useNavigate();
  const alert = useAlert();

  useLayoutEffect(() => {
    getDatabaseTypeList();
  }, []);

  useEffect(() => {
    if (dataType) {
      console.log('type:', dataType.type);
      switch (dataType.type) {
        case 'mysql':
          setDatabaseForm(mysqlForm);
          break;
        case 'maria':
          setDatabaseForm(mysqlForm);
          break;
        case 'postgres':
          setDatabaseForm(mysqlForm);
          break;
        case 'oracle':
          setDatabaseForm(mysqlForm);
          break;
        case 'db2':
          setDatabaseForm(mysqlForm);
          break;
        case 'redshift':
          setDatabaseForm(mysqlForm);
          break;
        case 'bigquery':
          setDatabaseForm(mysqlForm);
          break;
        case 'sqlite':
          setDatabaseForm(mysqlForm);
          break;
        case 'mssql':
          setDatabaseForm(mysqlForm);
          break;
        case 'snowflake':
          setDatabaseForm(mysqlForm);
          break;
        default:
      }
    }
  }, [dataType]);

  const testConnect = item => {
    console.log('testConnect ', item);

    const param = {
      name: item.name,
      description: item.name,
      connectionConfig: item,
      engine: dataType.type,
    };
    DatabaseService.testConnection(param).then(response => {
      console.log(response);
      if (response.data.status === STATUS.SUCCESS) {
        setIsConnected(true);
      } else {
        alert.info('데이터 베이스에 연결할 수 없습니다.\n데이터 베이스 정보를 확인해주세요.');
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
    const param = {
      name: formData.databaseName,
      description: formData.databaseName,
      connectionConfig: formData,
      engine: dataType.type,
    };
    console.log('handleSave', param);
    DatabaseService.createDatabase(param).then(response => {
      console.log(response.data);
    });
  };

  const handleCancelClick = () => {
    navigate('/data');
  };

  return (
    <PageContainer>
      <PageTitleBox
        title={'데이터 소스 연결'}
        button={
          <ConfirmCancelButton
            confirmProps={{ disabled: false, onClick: handleSaveClick }}
            cancelProps={{ onClick: handleCancelClick }}
          />
        }
      >
        <Stack spacing={3}>
          <TitleBox title={'step.01 타입 설정'}>
            <ImgCardList data={typeList} selectedType={dataType} setSelectedType={setDataType} />
          </TitleBox>
          <TitleBox title={'step.02 연결 정보 입력'}>
            <LabelInputForm data={databaseForm} testConnect={testConnect} formData={formData} setFormData={setFormData} />
          </TitleBox>
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataSource;
