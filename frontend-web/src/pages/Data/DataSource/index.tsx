import React, { useEffect, useState } from 'react';
import { Stack } from '@mui/material';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import TitleBox from '@/components/TitleBox';
import ImgCardList from '@/components/ImgCardList';
import LabelInputForm from '@/components/form/LabelInputForm';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import DatabaseService from '@/api/databaseService';

const typeList = [
  { id: '0', title: 'MySQL', icon: 'logo/mysql-logo.svg' },
  { id: '1', title: 'MariaDB', icon: 'logo/mariadb-logo.svg' },
  { id: '2', title: 'PostgreSQL', icon: 'logo/pgsql-logo.svg' },
  { id: '3', title: 'Oracle', icon: 'logo/oracle-logo.svg' },
  { id: '4', title: 'Db2', icon: 'logo/db2-logo.svg' },
  { id: '5', title: 'Redshift', icon: 'logo/redshift-logo.svg' },
  { id: '6', title: 'BigQuery', icon: 'logo/bigquery-logo.svg' },
  { id: '7', title: 'SQLite', icon: 'logo/sqlite-logo.svg' },
  { id: '8', title: 'MSSQL', icon: 'logo/mssql-logo.svg' },
  { id: '9', title: 'AltiBase', icon: 'logo/altibase-logo.png' },
];

const formList = [
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

  useEffect(() => {
    if (dataType) {
      console.log('type:', dataType.title);
    }
  }, [dataType]);

  const testConnect = item => {
    console.log('testConnect ', item);
    const param = {
      name: item.name,
      description: item.name,
      connectionConfig: {
        client: 'mysql',
        connection: item,
      },
      engine: 'mysql',
      timezone: 'Asia/Seoul',
    };
    DatabaseService.testConnection(param).then(response => {
      console.log(response);
      setIsConnected(response.data === 'success');
    });
  };

  const handleSaveClick = () => {
    console.log('save database');
  };

  return (
    <PageContainer>
      <PageTitleBox
        title={'데이터 소스 연결'}
        button={<ConfirmCancelButton confirmProps={{ disabled: !isConnected, onClick: handleSaveClick }} />}
      >
        <Stack spacing={3}>
          <TitleBox title={'step.01 타입 설정'}>
            <ImgCardList data={typeList} selectedType={dataType} setSelectedType={setDataType} />
          </TitleBox>
          <TitleBox title={'step.02 연결 정보 입력'}>
            <LabelInputForm data={formList} testConnect={testConnect} />
          </TitleBox>
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataSource;
