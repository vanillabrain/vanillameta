import React, { useEffect, useState } from 'react';
import { Stack } from '@mui/material';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import TitleBox from '@/components/TitleBox';
import ImgCardList from '@/components/ImgCardList';
import LabelInputForm from '@/components/form/LabelInputForm';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';

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
  { id: '0', label: '이름', name: 'userName' },
  { id: '1', label: 'HOST', name: 'userHost', width: '50%' },
  { id: '2', label: 'Port', name: 'userPort', width: '50%' },
  { id: '3', label: 'User', name: 'userId' },
  { id: '4', label: 'Password', name: 'userPassword', type: 'password' },
  { id: '5', label: 'Schema', name: 'userSchema' },
];

function DataSource(props) {
  const [isConnected, setIsConnected] = useState(false);
  const [dataType, setDataType] = useState(null);

  useEffect(() => {
    if (dataType) {
      console.log('type:', typeList[dataType].title);
    }
  }, [dataType]);

  return (
    <PageContainer>
      <PageTitleBox title={'데이터 소스 연결'} button={<ConfirmCancelButton confirmProps={{ disabled: !isConnected }} />}>
        <Stack spacing={3}>
          <TitleBox title={'step.01 타입 설정'}>
            <ImgCardList data={typeList} selectedType={dataType} setSelectedType={setDataType} />
          </TitleBox>
          <TitleBox title={'step.02 연결 정보 입력'}>
            <LabelInputForm data={formList} />
          </TitleBox>
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataSource;
